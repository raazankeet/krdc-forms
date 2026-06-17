from __future__ import annotations

from typing import Any

from app.models.form import Form


def _is_blank(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() == ""
    if isinstance(value, (list, tuple, set, dict)):
        return len(value) == 0
    return False


def _validate_required_fields(form: Form, data: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    for field in form.fields or []:
        if not field.is_required:
            continue

        value = data.get(field.field_name)
        if field.field_type == "rating":
            try:
                if float(value) <= 0:
                    errors.append(f"{field.field_label} is required.")
            except (TypeError, ValueError):
                errors.append(f"{field.field_label} is required.")
            continue

        if _is_blank(value):
            errors.append(f"{field.field_label} is required.")
    return errors


def _validate_mpai(data: dict[str, Any]) -> list[str]:
    errors: list[str] = []

    required_fields = {
        "product_name": "Name of Product is required.",
        "study_no": "Study No. is required.",
        "test": "Test is required.",
        "test_item_code": "Test Item Code is required.",
        "instrument_id": "Instrument ID is required.",
        "analysis_date": "Analysis Date is required.",
        "test_item_batch_no": "Test Item Batch no. is required.",
        "standard_name": "Standard Name is required.",
        "standard_batch_no": "Batch No. is required.",
    }
    for field_name, message in required_fields.items():
        if _is_blank(data.get(field_name)):
            errors.append(message)

    analysis_date = str(data.get("analysis_date", "")).strip()
    if analysis_date:
        try:
            from datetime import date

            if date.fromisoformat(analysis_date) > date.today():
                errors.append("Analysis Date cannot be in the future.")
        except ValueError:
            errors.append("Analysis Date must be a valid date.")

    numeric_fields = [
        "standard_potency",
        "standard_dilution_1_weight_mg",
        "standard_dilution_1_make_up_ml",
        "standard_dilution_2_aliquot_ml",
        "standard_dilution_2_make_up_ml",
        "standard_dilution_3_aliquot_ml",
        "standard_dilution_3_make_up_ml",
        "sample_dilution_weight_mg",
        "sample_dilution_make_up_ml",
        "sample_dilution_2_aliquot_ml",
        "sample_dilution_2_make_up_ml",
        "sample_dilution_3_aliquot_ml",
        "sample_dilution_3_make_up_ml",
        "reporting_decimals",
        "ai_potency_standard_percent",
        "sample_potency",
    ]
    for field_name in numeric_fields:
        value = data.get(field_name)
        if _is_blank(value):
            continue
        try:
            float(value)
        except (TypeError, ValueError):
            errors.append(f"{field_name.replace('_', ' ').title()} must be numeric.")

    for index, row in enumerate(data.get("standard_injections") or []):
        value = row.get("area_count")
        if _is_blank(value):
            continue
        try:
            float(value)
        except (TypeError, ValueError):
            errors.append(f"Standard injection {index + 1} area count must be numeric.")

    for index, row in enumerate(data.get("samples") or []):
        for field_name in ("weight_mg", "injection_1", "injection_2"):
            value = row.get(field_name)
            if _is_blank(value):
                continue
            try:
                float(value)
            except (TypeError, ValueError):
                errors.append(f"Sample {index + 1} {field_name.replace('_', ' ')} must be numeric.")

    return errors

def validate_submission_payload(form: Form, data: dict[str, Any]) -> list[str]:
    if form.form_code == "MPAI":
        errors = _validate_mpai(data)
    else:
        errors = _validate_required_fields(form, data)

    # Keep ordering stable while removing duplicates.
    return list(dict.fromkeys(errors))
