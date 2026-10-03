# Pod Restart Loop

## 1. Symptom

A `user-service` pod has restarted more than 3 times in 10 minutes. The service may still be
reachable (if other replicas/the previous pod are up) but is unstable — requests may be dropped
during each restart window.

Alert: `Pod Restart Loop — default` (Grafana Cloud, severity `warning`). Query:
```
increase(kube_pod_container_status_restarts_total{namespace="default"}[10m]) > 3
```
Requires `kube-state-metrics` to be deployed and scraped — this metric does not come from the app
itself. If this alert is stuck on "No data," check `kube-state-metrics` is `Running` in the
`monitoring` namespace and is a healthy scrape target before assuming the app is fine.

## 2. Probable causes (most likely first)

1. **Bad image — container starts then exits immediately** (crashes on boot: missing required
   env var, bad startup code, wrong entrypoint).
2. **OOMKilled** — container exceeds its memory limit and gets killed by the kernel.
3. **Liveness probe misconfigured** — probe fails before the app finishes starting up, kubelet
   kills a perfectly fine container.
4. **App crashing on a specific code path** shortly after start (e.g. a bad migration, a bad
   config value it reads once at boot).

## 3. Diagnostic commands

```bash
export KUBECONFIG=~/.kube/config-day31

# First question: has this pod EVER reached Running, or is it stuck before that?
# This distinction matters — ImagePullBackOff / ErrImagePull means the container never
# started at all, so the restart counter does NOT increase and this alert will never fire
# for that case. If you're debugging a pull failure, that's a different problem
# (wrong image tag / registry auth), not this runbook.
kubectl describe pod -n default <pod-name>
# Look at "State" / "Last State" and the Events section at the bottom:
#   - "Back-off restarting failed container" + prior "Started" events  -> real crash loop (this runbook)
#   - "Failed to pull image" / stuck on ImagePullBackOff, no "Started" events -> wrong runbook, fix the image reference instead

# What did it log in the run right before it died? (current logs reset on every restart)
kubectl logs -n default <pod-name> --previous --tail=100

# Any OOM or eviction events cluster-wide, in order?
kubectl get events -n default --sort-by='.lastTimestamp' | tail -20
```

## 4. Fix actions (most common first)

1. **Rollback if this started right after a deploy**:
   ```bash
   kubectl rollout undo deployment/user-service -n default
   ```
   Verification: `kubectl get pods -n default -w` — new pod reaches `Running` and stays there.

2. **Increase liveness probe `initialDelaySeconds`** if the app is just slow to start and the
   probe is killing it prematurely (edit the deployment's probe config, not a one-line kubectl
   command — requires a manifest/Helm values change).

3. **Increase memory limit** if `kubectl describe pod` shows `OOMKilled` in the last state:
   edit the deployment's `resources.limits.memory` and redeploy.

## 5. Escalation

If restarts continue after a rollback (i.e. even the previously-good image won't stay up): post
in `#incidents` — this points at an environment/infra issue (node resource pressure, a changed
dependency like the database being unreachable), not a bad app release.
