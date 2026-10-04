#!/usr/bin/env python3
"""
Export review sheets for all pujas.
Creates one markdown file per puja with samagri table, vidhi steps, and regional variations.
"""

import json
import os
from pathlib import Path

def load_content():
    """Load all content files."""
    content_dir = Path(__file__).parent.parent / "content"

    # Load samagri catalog
    with open(content_dir / "samagri.json") as f:
        samagri_list = json.load(f)
    samagri_map = {item["id"]: item for item in samagri_list}

    # Load all pujas
    pujas_dir = content_dir / "pujas"
    pujas = {}
    if pujas_dir.exists():
        for puja_file in sorted(pujas_dir.glob("*.json")):
            with open(puja_file) as f:
                puja = json.load(f)
                pujas[puja["id"]] = puja

    return pujas, samagri_map

def get_locale_text(locale_map, default=""):
    """Get English or Hindi text from locale map."""
    if isinstance(locale_map, dict):
        return locale_map.get("en", locale_map.get("hi", default))
    return str(locale_map)

def generate_review_sheet(puja, samagri_map):
    """Generate markdown review sheet for a puja."""
    lines = []

    # Title
    puja_name = get_locale_text(puja["name"])
    lines.append(f"# {puja_name}\n")

    # Basic Info
    lines.append("## Basic Information")
    lines.append(f"- **ID**: `{puja['id']}`")
    lines.append(f"- **Category**: {puja.get('category', 'N/A')}")
    lines.append(f"- **Regions**: {', '.join(puja.get('regions', []))}")
    lines.append(f"- **Review Status**: {puja.get('reviewStatus', 'N/A')}")
    lines.append(f"- **Content Version**: {puja.get('contentVersion', 'N/A')}\n")

    # Summary
    lines.append("## Summary")
    lines.append(get_locale_text(puja.get("summary", {})))
    lines.append("")

    # Significance
    lines.append("## Significance")
    lines.append(get_locale_text(puja.get("significance", {})))
    lines.append("")

    # Samagri Table
    lines.append("## Samagri (Materials)")
    lines.append("| Item | Classification | Purpose |")
    lines.append("|------|-----------------|---------|")

    for samagri_usage in puja.get("samagri", []):
        samagri_id = samagri_usage["samagriId"]
        samagri_item = samagri_map.get(samagri_id, {})
        item_name = get_locale_text(samagri_item.get("name", samagri_id))
        classification = samagri_usage.get("classification", "N/A")
        purpose = get_locale_text(samagri_usage.get("purpose", ""))
        lines.append(f"| {item_name} | {classification} | {purpose} |")

    lines.append("")

    # Vidhi Steps
    lines.append("## Vidhi (Steps)")
    for step in puja.get("steps", []):
        step_num = step.get("stepNumber", "?")
        step_title = get_locale_text(step.get("title", ""))
        step_desc = get_locale_text(step.get("description", ""))
        is_optional = " (Optional)" if step.get("isOptional", False) else ""
        lines.append(f"**Step {step_num}: {step_title}{is_optional}**")
        lines.append(step_desc)
        lines.append("")

    # Regional Variations
    if puja.get("variations"):
        lines.append("## Regional Variations")
        for variation in puja["variations"]:
            var_title = get_locale_text(variation.get("title", ""))
            var_desc = get_locale_text(variation.get("description", ""))
            var_regions = ", ".join(variation.get("regions", []))
            lines.append(f"**{var_title}** (Regions: {var_regions})")
            lines.append(var_desc)
            lines.append("")

    # Source and Review Note
    lines.append("## Review Information")
    lines.append(f"**Source Note**: {get_locale_text(puja.get('sourceNote', {}))}")
    lines.append("")

    if puja.get("disclaimer"):
        lines.append("## Disclaimer")
        lines.append(get_locale_text(puja.get("disclaimer")))
        lines.append("")

    return "\n".join(lines)

def main():
    """Generate and save all review sheets."""
    pujas, samagri_map = load_content()

    # Create review directory
    review_dir = Path(__file__).parent.parent / "docs" / "review"
    review_dir.mkdir(parents=True, exist_ok=True)

    # Generate review sheet for each puja
    for puja_id, puja in pujas.items():
        review_sheet = generate_review_sheet(puja, samagri_map)
        output_file = review_dir / f"{puja_id}.md"
        with open(output_file, "w") as f:
            f.write(review_sheet)
        print(f"✓ Generated review sheet: {output_file}")

    print(f"\n✓ Review sheets generated in {review_dir}")
    print(f"  Total pujas: {len(pujas)}")

if __name__ == "__main__":
    main()
