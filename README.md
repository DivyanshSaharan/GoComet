# Nova Trade Document Pipeline

Part 1 POC for the GoComet Nova Full-Stack AI Engineer DAW.

This repo builds a small multi-agent pipeline for trade document validation:

1. Extract structured shipment fields from a PDF, image, or text document.
2. Validate the extracted fields against customer-specific rules.
3. Route the shipment to auto-approval, human review, or amendment drafting.
4. Store verified output in SQLite and answer simple grounded questions.
5. Show the full run state in a minimal browser UI.

The app is intentionally shaped so Part 2 can add an inbox/folder trigger and multi-document shipment validation without replacing the Part 1 agents.

