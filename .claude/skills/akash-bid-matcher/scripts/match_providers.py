#!/usr/bin/env python3
"""
Match an Akash SDL against the live provider set.

Fetches providers from https://console-api.akash.network/v1/providers,
filters for online + audited, then checks how many can satisfy each profile
in the SDL. Outputs a JSON report with a filter funnel, matching providers,
and the single biggest constraint.

Usage:
    python match_providers.py <sdl.yaml> [--json] [--top N] [--api URL]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.request
from dataclasses import dataclass, field
from typing import Any

try:
    import yaml
except ImportError:
    sys.stderr.write("Missing dependency: PyYAML. Install with: pip install pyyaml\n")
    sys.exit(2)


DEFAULT_API = "https://console-api.akash.network/v1/providers"
IBC_DENOM_RE = re.compile(r"^ibc/[A-F0-9]{64}$", re.IGNORECASE)


# ---------- Unit parsing ----------

_CPU_SUFFIX = {"m": 1}  # millicores
_MEM_SUFFIX_BIN = {"Ki": 1024, "Mi": 1024**2, "Gi": 1024**3, "Ti": 1024**4, "Pi": 1024**5}
_MEM_SUFFIX_DEC = {"k": 1000, "M": 1000**2, "G": 1000**3, "T": 1000**4, "P": 1000**5}


def parse_cpu_millis(v: Any) -> int:
    """SDL cpu.units accepts 0.5, 2, '500m'. Returns millicores."""
    if v is None:
        return 0
    if isinstance(v, (int, float)):
        return int(round(float(v) * 1000))
    s = str(v).strip()
    if s.endswith("m"):
        return int(s[:-1])
    return int(round(float(s) * 1000))


def parse_bytes(v: Any) -> int:
    """Parse memory/storage size like '512Mi', '2Gi', '100M', or a raw integer of bytes."""
    if v is None:
        return 0
    if isinstance(v, (int, float)):
        return int(v)
    s = str(v).strip()
    for suf, mult in {**_MEM_SUFFIX_BIN, **_MEM_SUFFIX_DEC}.items():
        if s.endswith(suf):
            return int(float(s[: -len(suf)]) * mult)
    return int(float(s))


def fmt_bytes(n: int) -> str:
    if n <= 0:
        return "0"
    for suf, mult in [("Ti", 1024**4), ("Gi", 1024**3), ("Mi", 1024**2), ("Ki", 1024)]:
        if n >= mult:
            return f"{n / mult:.1f}{suf}"
    return f"{n}B"


# ---------- SDL extraction ----------

@dataclass
class ProfileRequirement:
    profile: str
    services: list[str]
    count: int
    cpu_millis: int
    memory_bytes: int
    storage_ephemeral_bytes: int
    storage_persistent_bytes: int
    storage_classes: list[str]
    gpu_units: int
    gpu_vendor: str | None
    gpu_models: list[str]
    needs_ip_endpoint: bool
    denom: str | None
    price_amount: int | None


def extract_requirements(sdl: dict) -> list[ProfileRequirement]:
    compute = (sdl.get("profiles") or {}).get("compute") or {}
    placement = (sdl.get("profiles") or {}).get("placement") or {}
    deployment = sdl.get("deployment") or {}
    services = sdl.get("services") or {}
    endpoints = sdl.get("endpoints") or {}

    # services that use an IP endpoint (v2.1)
    services_using_ip: set[str] = set()
    for svc_name, svc in services.items():
        for exp in svc.get("expose", []) or []:
            for to in exp.get("to", []) or []:
                if "ip" in to:
                    services_using_ip.add(svc_name)
    ip_endpoint_declared = bool(endpoints)

    # profile -> services using it; deployment maps service -> placement -> {profile, count}
    profile_to_services: dict[str, list[tuple[str, int]]] = {}
    denom_by_profile: dict[str, tuple[str | None, int | None]] = {}

    for svc_name, placements in deployment.items():
        for place_name, spec in (placements or {}).items():
            prof = spec.get("profile")
            count = int(spec.get("count", 1))
            if not prof:
                continue
            profile_to_services.setdefault(prof, []).append((svc_name, count))
            price = ((placement.get(place_name) or {}).get("pricing") or {}).get(prof)
            if price:
                denom_by_profile[prof] = (price.get("denom"), price.get("amount"))

    reqs: list[ProfileRequirement] = []
    for prof_name, prof in compute.items():
        resources = prof.get("resources") or {}
        cpu_millis = parse_cpu_millis((resources.get("cpu") or {}).get("units"))
        memory_bytes = parse_bytes((resources.get("memory") or {}).get("size"))

        storage_raw = resources.get("storage")
        ephemeral = 0
        persistent = 0
        classes: list[str] = []
        if isinstance(storage_raw, dict):
            ephemeral = parse_bytes(storage_raw.get("size"))
        elif isinstance(storage_raw, list):
            for entry in storage_raw:
                size = parse_bytes(entry.get("size"))
                attrs = entry.get("attributes") or {}
                cls = attrs.get("class")
                is_persistent = bool(attrs.get("persistent"))
                if is_persistent:
                    persistent += size
                else:
                    ephemeral += size
                if cls and cls != "ram" and is_persistent:
                    classes.append(cls)

        gpu_raw = resources.get("gpu") or {}
        gpu_units = int(gpu_raw.get("units", 0) or 0)
        gpu_vendor = None
        gpu_models: list[str] = []
        if gpu_units > 0:
            vendor_attr = (gpu_raw.get("attributes") or {}).get("vendor") or {}
            for v, models in vendor_attr.items():
                gpu_vendor = v
                for m in models or []:
                    if isinstance(m, dict) and m.get("model"):
                        gpu_models.append(str(m["model"]).lower())

        svc_list = profile_to_services.get(prof_name, [])
        total_count = sum(c for _, c in svc_list) or 1
        needs_ip = any(s in services_using_ip for s, _ in svc_list) or ip_endpoint_declared
        denom, amount = denom_by_profile.get(prof_name, (None, None))

        reqs.append(
            ProfileRequirement(
                profile=prof_name,
                services=[s for s, _ in svc_list],
                count=total_count,
                cpu_millis=cpu_millis * total_count,
                memory_bytes=memory_bytes * total_count,
                storage_ephemeral_bytes=ephemeral * total_count,
                storage_persistent_bytes=persistent * total_count,
                storage_classes=sorted(set(classes)),
                gpu_units=gpu_units * total_count,
                gpu_vendor=gpu_vendor,
                gpu_models=sorted(set(gpu_models)),
                needs_ip_endpoint=needs_ip,
                denom=denom,
                price_amount=amount,
            )
        )
    return reqs


# ---------- Provider matching ----------

_STORAGE_CLASS_ATTR_RE = re.compile(r"^capabilities/storage/(\d+)/class$")
_STORAGE_PERSIST_ATTR_RE = re.compile(r"^capabilities/storage/(\d+)/persistent$")


def provider_persistent_classes(provider: dict) -> set[str]:
    """Return the set of persistent storage classes a provider supports, based on its attributes.

    Providers declare class support via attribute pairs:
      capabilities/storage/<N>/class       = beta2 | beta3 | ram | ...
      capabilities/storage/<N>/persistent  = true | false

    A class counts as persistent-capable only when the matching slot's persistent=true.
    Also honors the alternate `feat-persistent-storage-type=<class>` attribute form.
    """
    by_slot_class: dict[str, str] = {}
    by_slot_persist: dict[str, bool] = {}
    extra_persistent: set[str] = set()
    for attr in provider.get("attributes") or []:
        key = (attr.get("key") or "").strip()
        val = str(attr.get("value") or "").strip().lower()
        m = _STORAGE_CLASS_ATTR_RE.match(key)
        if m:
            by_slot_class[m.group(1)] = val
            continue
        m = _STORAGE_PERSIST_ATTR_RE.match(key)
        if m:
            by_slot_persist[m.group(1)] = val == "true"
            continue
        if key == "feat-persistent-storage-type" and val:
            extra_persistent.add(val)
    out: set[str] = set(extra_persistent)
    for slot, cls in by_slot_class.items():
        if by_slot_persist.get(slot) and cls not in ("ram",):
            out.add(cls)
    return out


def provider_supports_storage_class(provider: dict, cls: str) -> bool:
    return cls.lower() in provider_persistent_classes(provider)


def provider_gpu_models(provider: dict, vendor: str | None) -> set[str]:
    out: set[str] = set()
    for g in provider.get("gpuModels") or []:
        if vendor and (g.get("vendor") or "").lower() != vendor.lower():
            continue
        model = (g.get("model") or "").lower()
        if model:
            out.add(model)
    return out


def check_provider(provider: dict, req: ProfileRequirement) -> dict[str, bool]:
    stats = provider.get("stats") or {}
    cpu_avail = int((stats.get("cpu") or {}).get("available", 0) or 0)
    mem_avail = int((stats.get("memory") or {}).get("available", 0) or 0)
    storage = stats.get("storage") or {}
    eph_avail = int((storage.get("ephemeral") or {}).get("available", 0) or 0)
    pers_avail = int((storage.get("persistent") or {}).get("available", 0) or 0)
    gpu_avail = int((stats.get("gpu") or {}).get("available", 0) or 0)

    checks = {
        "cpu": cpu_avail >= req.cpu_millis,
        "memory": mem_avail >= req.memory_bytes,
        "storage_ephemeral": eph_avail >= req.storage_ephemeral_bytes,
        "storage_persistent": (
            pers_avail >= req.storage_persistent_bytes if req.storage_persistent_bytes > 0 else True
        ),
        "storage_classes": (
            all(provider_supports_storage_class(provider, c) for c in req.storage_classes)
            if req.storage_classes
            else True
        ),
        "gpu_count": gpu_avail >= req.gpu_units if req.gpu_units > 0 else True,
        "gpu_model": (
            (not req.gpu_models)
            or bool(provider_gpu_models(provider, req.gpu_vendor) & set(req.gpu_models))
            if req.gpu_units > 0
            else True
        ),
        "ip_endpoint": bool(provider.get("featEndpointIp")) if req.needs_ip_endpoint else True,
    }
    return checks


# ---------- Reporting ----------

def fetch_providers(api_url: str) -> list[dict]:
    req = urllib.request.Request(
        api_url,
        headers={
            "Accept": "application/json",
            "User-Agent": "akash-bid-matcher/0.1 (+https://github.com/akash-network/console)",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
    if isinstance(data, dict) and "providers" in data:
        data = data["providers"]
    return data


def summarize(providers: list[dict], reqs: list[ProfileRequirement], top_n: int = 5) -> dict:
    online = [p for p in providers if p.get("isOnline")]
    online_audited = [p for p in online if p.get("isAudited")]

    per_profile = []
    for req in reqs:
        funnel_stages: list[tuple[str, int]] = [
            ("total_providers", len(providers)),
            ("online", len(online)),
            ("online_audited", len(online_audited)),
        ]

        check_names = [
            "cpu",
            "memory",
            "storage_ephemeral",
            "storage_persistent",
            "storage_classes",
            "gpu_count",
            "gpu_model",
            "ip_endpoint",
        ]

        matches: list[dict] = []
        per_check_pass = {name: 0 for name in check_names}
        pool = online_audited

        for p in pool:
            checks = check_provider(p, req)
            for k, v in checks.items():
                if v:
                    per_check_pass[k] += 1
            if all(checks.values()):
                matches.append(
                    {
                        "owner": p.get("owner"),
                        "organization": p.get("organization") or p.get("host"),
                        "hostUri": p.get("hostUri"),
                        "region": p.get("locationRegion"),
                        "country": p.get("country"),
                        "tier": p.get("tier"),
                        "gpuModels": [
                            f"{g.get('vendor')}/{g.get('model')}" for g in p.get("gpuModels") or []
                        ],
                    }
                )

        # Biggest filter = applicable check with lowest pass count (among checks that matter)
        applicable = [n for n in check_names if _check_applies(n, req)]
        biggest_filter = None
        if applicable:
            biggest_filter = min(applicable, key=lambda n: per_check_pass[n])

        per_profile.append(
            {
                "profile": req.profile,
                "services": req.services,
                "count": req.count,
                "requirements": {
                    "cpu_millis": req.cpu_millis,
                    "memory": fmt_bytes(req.memory_bytes),
                    "storage_ephemeral": fmt_bytes(req.storage_ephemeral_bytes),
                    "storage_persistent": fmt_bytes(req.storage_persistent_bytes),
                    "storage_classes": req.storage_classes,
                    "gpu_units": req.gpu_units,
                    "gpu_vendor": req.gpu_vendor,
                    "gpu_models": req.gpu_models,
                    "needs_ip_endpoint": req.needs_ip_endpoint,
                    "denom": req.denom,
                    "price_amount": req.price_amount,
                },
                "funnel": [{"stage": s, "count": c} for s, c in funnel_stages]
                + [
                    {"stage": f"passes_{n}", "count": per_check_pass[n], "applicable": _check_applies(n, req)}
                    for n in check_names
                ],
                "biggest_filter": biggest_filter,
                "match_count": len(matches),
                "top_matches": matches[:top_n],
                "feasible": len(matches) > 0,
                "denom_note": _denom_note(req.denom),
            }
        )

    return {
        "api": "console-api.akash.network/v1/providers",
        "total_providers": len(providers),
        "online_providers": len(online),
        "online_audited_providers": len(online_audited),
        "profiles": per_profile,
    }


def _check_applies(name: str, req: ProfileRequirement) -> bool:
    if name == "storage_persistent":
        return req.storage_persistent_bytes > 0
    if name == "storage_classes":
        return bool(req.storage_classes)
    if name in ("gpu_count", "gpu_model"):
        return req.gpu_units > 0
    if name == "ip_endpoint":
        return req.needs_ip_endpoint
    return True


KNOWN_DENOMS = {"uakt", "uact"}


def _denom_note(denom: str | None) -> str | None:
    if denom is None:
        return None
    if denom in KNOWN_DENOMS:
        return None
    if IBC_DENOM_RE.match(denom):
        return None
    return (
        f"denom '{denom}' is not a recognized Akash denom (uakt, uact) or ibc/… — "
        "providers endpoint does not expose accepted denoms; verify support separately."
    )


# ---------- CLI ----------

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Match an SDL against live Akash providers.")
    parser.add_argument("sdl", help="Path to SDL YAML file")
    parser.add_argument("--api", default=DEFAULT_API, help="Providers API URL")
    parser.add_argument("--top", type=int, default=5, help="Top matching providers to include")
    parser.add_argument("--json", action="store_true", help="Emit JSON only (no pretty header)")
    args = parser.parse_args(argv)

    with open(args.sdl, "r") as f:
        sdl = yaml.safe_load(f)

    reqs = extract_requirements(sdl)
    providers = fetch_providers(args.api)
    report = summarize(providers, reqs, top_n=args.top)

    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
