"""One-off: upsert the three decision-email variables on the Railway `foot` service.
Values are read from /app/.env (never printed)."""
import json, os, sys, urllib.request

TOKEN = os.environ["RAILWAY_PROJECT_TOKEN"]
PROJECT = "77f272bd-6cc8-41af-be9d-73f6f8d946b3"
ENV = "92b81ad0-fd2f-4165-8cbd-ed407773d8f6"
SERVICE = "0977eaac-1c6c-47ca-8054-8a150ad03113"

env = {}
for line in open("/app/.env"):
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

values = {
    "EMERGENT_EMAIL_KEY": env["EMERGENT_EMAIL_KEY"],
    "EMAIL_FROM_NAME": env["EMAIL_FROM_NAME"],
    "PUBLIC_APP_URL": "https://foot-production-9784.up.railway.app",
}


def gql(query, variables):
    req = urllib.request.Request(
        "https://backboard.railway.app/graphql/v2",
        data=json.dumps({"query": query, "variables": variables}).encode(),
        headers={"Project-Access-Token": TOKEN, "Content-Type": "application/json", "User-Agent": "curl/8"},
    )
    return json.load(urllib.request.urlopen(req))


for name, value in values.items():
    r = gql(
        "mutation($input: VariableUpsertInput!) { variableUpsert(input: $input) }",
        {"input": {"projectId": PROJECT, "environmentId": ENV, "serviceId": SERVICE, "name": name, "value": value}},
    )
    print(name, "->", "OK" if r.get("data", {}).get("variableUpsert") else r)

r = gql(
    "query($p: String!, $e: String!, $s: String!) { variables(projectId: $p, environmentId: $e, serviceId: $s) }",
    {"p": PROJECT, "e": ENV, "s": SERVICE},
)
print("names now set:", sorted(r["data"]["variables"].keys()))
