from .models import Decision, DecisionOutcome, ValidationResult, ValidationStatus


class RouterAgent:
    def run(self, validations: list[ValidationResult]) -> Decision:
        mismatches = [item for item in validations if item.status == ValidationStatus.MISMATCH]
        uncertain = [item for item in validations if item.status == ValidationStatus.UNCERTAIN]

        if mismatches:
            lines = [
                "Hello SU team,",
                "",
                "CG reviewed the submitted trade document and needs the following amendments:",
            ]
            for item in mismatches:
                lines.append(f"- {item.field_name}: found '{item.found}', expected '{item.expected}'.")
            if uncertain:
                lines.append("")
                lines.append("Please also confirm these uncertain fields:")
                for item in uncertain:
                    lines.append(f"- {item.field_name}: {item.reason}")
            lines.append("")
            lines.append("Please resend the corrected document set for validation.")
            return Decision(
                outcome=DecisionOutcome.AMENDMENT_REQUEST,
                reasoning="One or more required fields conflict with the customer rule set.",
                draft_message="\n".join(lines),
                blockers=[item.field_name for item in mismatches + uncertain],
            )

        if uncertain:
            blockers = ", ".join(item.field_name for item in uncertain)
            return Decision(
                outcome=DecisionOutcome.HUMAN_REVIEW,
                reasoning=f"Required fields need CG review before approval: {blockers}.",
                draft_message="Please review the uncertain extracted fields before sending any response.",
                blockers=[item.field_name for item in uncertain],
            )

        return Decision(
            outcome=DecisionOutcome.AUTO_APPROVE,
            reasoning="All required fields matched the customer rules with acceptable confidence.",
            draft_message="Document validation passed. CG may approve this shipment document set.",
        )

