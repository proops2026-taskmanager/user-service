# High 5xx Error Rate

## 1. Symptom

`user-service` is returning HTTP 5xx to more than 5% of requests for 2+ minutes. Users see failed
requests (registration, login, or whatever endpoint is affected) even though the service is
reachable and pods show `Running`.

Alert: `High 5xx Error Rate — taskmanager` (Grafana Cloud, severity `critical`). Query:
```
sum(rate(http_requests_total{status=~"5.."}[2m])) / sum(rate(http_requests_total[2m]))
```
Note: this metric has no `namespace` label — do not add one to ad-hoc queries, it will silently
return no data instead of erroring.

## 2. Probable causes (most likely first)

1. **Recent deploy introduced a bad code path** — unhandled input that reaches the DB layer
   without validation (e.g. a field longer than its column limit).
2. **Database constraint/connection error** — check for Postgres errors in logs (`value too long`,
   connection pool exhausted, etc.).
3. **Downstream service unreachable** — check error messages for connection timeouts to other
   services.
4. **Resource exhaustion** — memory/CPU limit hit, causing slow responses that time out as errors.

## 3. Diagnostic commands

```bash
export KUBECONFIG=~/.kube/config-day31

# Did a recent deploy correlate with the spike?
kubectl rollout history deployment/user-service -n default

# Is the pod actually up, or restarting?
kubectl get pods -n default

# What's the pod saying right now? (current logs)
kubectl logs -n default deployment/user-service --tail=100 | grep -i error

# What was it saying in the run BEFORE the current one, if it already restarted?
# (current logs only cover the current container instance — a crash wipes the trail)
kubectl logs -n default deployment/user-service --previous --tail=100

# Resource pressure?
kubectl top pod -n default
```

## 4. Fix actions (most common first)

1. **Rollback to previous version** (safe, reversible):
   ```bash
   kubectl rollout undo deployment/user-service -n default
   ```
   Verification: error rate drops below 1% within ~2 min; confirm with
   `sum(rate(http_requests_total{status=~"5.."}[2m])) / sum(rate(http_requests_total[2m]))` in
   Grafana Cloud Explore.

2. **Scale up if resource exhaustion**:
   ```bash
   kubectl scale deployment/user-service --replicas=<higher> -n default
   ```
   Verification: `kubectl top pod -n default` — load spreads, error rate drops.

3. **Restart pod if a transient/memory-leak-style issue is suspected**:
   ```bash
   kubectl rollout restart deployment/user-service -n default
   ```
   Not reversible in the sense that it drops in-flight connections — acceptable for a single
   backend pod in this training setup, would need care (readiness gating, multiple replicas) in a
   real multi-replica production service.

## 5. Escalation

If none of the above resolves it within ~15 min: post in `#incidents` with the alert screenshot,
the last deploy SHA (`kubectl rollout history`), and the grep'd error lines from step 3.
