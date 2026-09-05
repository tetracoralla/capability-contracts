#!/usr/bin/env python3
"""Independent stdlib zoneinfo witness for time-zone.convert@0.2.0."""

from __future__ import annotations

import json
import math
import sys
from datetime import datetime, timezone
from importlib import metadata, resources
from pathlib import Path
from pathlib import PurePosixPath
from zoneinfo import TZPATH, ZoneInfo

MAX_LINE_BYTES = 1024 * 1024
MIN_YEAR = 1901


class CapabilityError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


class CarrierInputError(Exception):
    """A request that cannot participate in the Capability JSONL carrier."""


def time_zone_database() -> tuple[object, str]:
    for root in TZPATH:
        candidate = Path(root) / "tzdata.zi"
        try:
            first = candidate.read_text(encoding="utf-8", errors="replace").splitlines()[0]
        except (OSError, IndexError):
            continue
        if first.startswith("# version "):
            return Path(root), first.removeprefix("# version ").strip()
    try:
        return resources.files("tzdata.zoneinfo"), f"tzdata-{metadata.version('tzdata')}"
    except (ImportError, metadata.PackageNotFoundError, ModuleNotFoundError):
        raise RuntimeError("No versioned time-zone database is available.") from None


ZONEINFO_ROOT, TZDB_VERSION = time_zone_database()


def error_response(request_id: object, error: CapabilityError) -> dict[str, object]:
    return {
        "id": request_id,
        "ok": False,
        "error": {"code": error.code, "message": str(error), "retryable": False},
    }


def parse_zone(value: object) -> ZoneInfo:
    if not isinstance(value, str) or not value:
        raise CapabilityError("INVALID_INPUT", "Time-zone identifiers must be strings.")
    path = PurePosixPath(value)
    if path.is_absolute() or any(part in ("", ".", "..") for part in path.parts):
        raise CapabilityError("UNKNOWN_TIME_ZONE", f"Unknown IANA time zone: {value}")
    try:
        resource = ZONEINFO_ROOT.joinpath(*path.parts)
        with resource.open("rb") as stream:
            return ZoneInfo.from_file(stream, key=value)
    except (OSError, ValueError):
        raise CapabilityError("UNKNOWN_TIME_ZONE", f"Unknown IANA time zone: {value}") from None


def parse_local(value: object) -> datetime:
    if not isinstance(value, str):
        raise CapabilityError("INVALID_INPUT", "localDateTime must be a string.")
    try:
        parsed = datetime.strptime(value, "%Y-%m-%dT%H:%M")
    except ValueError:
        raise CapabilityError("INVALID_INPUT", "localDateTime is not a real ISO calendar minute.") from None
    if parsed.year < MIN_YEAR:
        raise CapabilityError("UNSUPPORTED_YEAR", f"Years before {MIN_YEAR} are outside this witness range.")
    return parsed


def offset_text(value) -> str:
    if value is None:
        raise CapabilityError("UNKNOWN_TIME_ZONE", "The time-zone offset is unavailable.")
    seconds = int(value.total_seconds())
    if seconds % 60 != 0:
        raise CapabilityError("UNSUPPORTED_PRECISION", "A resolved UTC offset has sub-minute precision.")
    sign = "+" if seconds >= 0 else "-"
    minutes = abs(seconds) // 60
    return f"{sign}{minutes // 60:02d}:{minutes % 60:02d}"


def instant_text(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def target_results(instant: datetime, targets: list[tuple[str, ZoneInfo]]) -> list[dict[str, str]]:
    results = []
    for name, zone in targets:
        local = instant.astimezone(zone)
        results.append({
            "timeZone": name,
            "localDateTime": local.strftime("%Y-%m-%dT%H:%M"),
            "offset": offset_text(local.utcoffset()),
        })
    return results


def possible_instants(local: datetime, zone: ZoneInfo) -> list[tuple[datetime, str]]:
    candidates: dict[datetime, str] = {}
    for fold in (0, 1):
        aware = local.replace(tzinfo=zone, fold=fold)
        instant = aware.astimezone(timezone.utc)
        round_trip = instant.astimezone(zone)
        if round_trip.replace(tzinfo=None) != local or round_trip.fold != fold:
            continue
        candidates[instant] = offset_text(round_trip.utcoffset())
    return sorted(candidates.items(), key=lambda item: item[0])


def convert(value: object) -> dict[str, object]:
    if not isinstance(value, dict) or set(value) - {
        "localDateTime", "sourceTimeZone", "targetTimeZones", "disambiguation"
    }:
        raise CapabilityError("INVALID_INPUT", "The canonical input object has unsupported fields.")
    if not {"localDateTime", "sourceTimeZone", "targetTimeZones"}.issubset(value):
        raise CapabilityError("INVALID_INPUT", "The canonical input is missing required fields.")
    target_names = value["targetTimeZones"]
    if (
        not isinstance(target_names, list)
        or not 1 <= len(target_names) <= 20
        or not all(isinstance(name, str) for name in target_names)
        or len(set(target_names)) != len(target_names)
    ):
        raise CapabilityError("INVALID_INPUT", "targetTimeZones must contain 1 to 20 distinct identifiers.")
    disambiguation = value.get("disambiguation", "reject")
    if disambiguation not in ("reject", "earlier", "later"):
        raise CapabilityError("INVALID_INPUT", "disambiguation must be reject, earlier, or later.")
    local = parse_local(value["localDateTime"])
    source_name = value["sourceTimeZone"]
    source_zone = parse_zone(source_name)
    targets = [(name, parse_zone(name)) for name in target_names]
    common = {
        "source": {"localDateTime": value["localDateTime"], "timeZone": source_name},
        "context": {"calendar": "iso8601", "timeZoneDatabase": TZDB_VERSION},
    }
    candidates = possible_instants(local, source_zone)
    if not candidates:
        return {"status": "nonexistent", **common}
    if len(candidates) == 2 and disambiguation == "reject":
        return {
            "status": "ambiguous",
            **common,
            "candidates": [
                {
                    "choice": choice,
                    "instant": instant_text(instant),
                    "sourceOffset": source_offset,
                    "results": target_results(instant, targets),
                }
                for choice, (instant, source_offset) in zip(("earlier", "later"), candidates)
            ],
        }
    selected = candidates[0 if disambiguation != "later" else -1]
    return {
        "status": "converted",
        **common,
        "instant": instant_text(selected[0]),
        "results": target_results(selected[0], targets),
    }


def handle(request: object) -> dict[str, object]:
    if not isinstance(request, dict) or set(request) != {"id", "operationId", "input"}:
        raise CarrierInputError("The Capability envelope is invalid.")
    if not isinstance(request["id"], str) or not request["id"]:
        raise CarrierInputError("The request id is invalid.")
    if request["operationId"] != "convert":
        raise CarrierInputError("The operation is unsupported.")
    try:
        return {"id": request["id"], "ok": True, "result": convert(request["input"])}
    except CapabilityError as error:
        return error_response(request["id"], error)


def reject_duplicate_keys(pairs: list[tuple[str, object]]) -> dict[str, object]:
    value: dict[str, object] = {}
    for key, item in pairs:
        if key in value:
            raise CarrierInputError("The request contains a duplicate object key.")
        value[key] = item
    return value


def parse_integer(value: str) -> int:
    parsed = int(value)
    if not -(2**53 - 1) <= parsed <= 2**53 - 1:
        raise CarrierInputError("The request contains an unsafe integer.")
    return parsed


def parse_float(value: str) -> float:
    parsed = float(value)
    if not math.isfinite(parsed):
        raise CarrierInputError("The request contains a non-finite number.")
    if parsed.is_integer() and abs(parsed) < 1e21 and abs(parsed) > 2**53 - 1:
        raise CarrierInputError("The request contains an unsafe integer-valued number.")
    return parsed


def reject_constant(_value: str) -> object:
    raise CarrierInputError("The request contains a non-JSON number.")


def assert_unicode_scalars(value: object) -> None:
    if isinstance(value, str):
        if any(0xD800 <= ord(character) <= 0xDFFF for character in value):
            raise CarrierInputError("The request contains an invalid Unicode scalar value.")
    elif isinstance(value, list):
        for item in value:
            assert_unicode_scalars(item)
    elif isinstance(value, dict):
        for key, item in value.items():
            assert_unicode_scalars(key)
            assert_unicode_scalars(item)


def parse_request(raw_line: bytes) -> object:
    try:
        request = json.loads(
            raw_line,
            object_pairs_hook=reject_duplicate_keys,
            parse_constant=reject_constant,
            parse_float=parse_float,
            parse_int=parse_integer,
        )
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise CarrierInputError("The request is not strict JSON.") from error
    assert_unicode_scalars(request)
    return request


while True:
    raw_line = sys.stdin.buffer.readline(MAX_LINE_BYTES + 1)
    if raw_line == b"":
        break
    try:
        if len(raw_line) > MAX_LINE_BYTES:
            raise CarrierInputError("The request line is too large.")
        if not raw_line.endswith(b"\n"):
            raise CarrierInputError("The request ended with a partial line.")
        response = handle(parse_request(raw_line))
    except CarrierInputError:
        sys.stderr.write("Capability JSONL carrier request rejected.\n")
        raise SystemExit(1) from None
    except Exception:
        sys.stderr.write("Capability provider failed without a semantic result.\n")
        raise SystemExit(1) from None
    sys.stdout.write(json.dumps(response, separators=(",", ":")) + "\n")
    sys.stdout.flush()
