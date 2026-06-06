import argparse
import json
from dataclasses import asdict

from nova_agents.pipeline import TradeDocumentPipeline


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the Nova trade document pipeline.")
    parser.add_argument("document", help="Path to a trade document PDF, image, or text sample.")
    parser.add_argument("--rules", default="rules/acme_customer.json")
    parser.add_argument("--db", default="data/nova_runs.db")
    args = parser.parse_args()

    run = TradeDocumentPipeline(args.rules, args.db).run(args.document)
    print(json.dumps(asdict(run), indent=2))


if __name__ == "__main__":
    main()

