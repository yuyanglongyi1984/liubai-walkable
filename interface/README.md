# 留白 Interface, version 1.0.0

The reading page is [interface.html](../interface.html). This folder is the contract.

| File | What it is |
| --- | --- |
| [operations.json](operations.json) | The operations, the live POST, the reserved names, and the upload limit |
| [openapi.json](openapi.json) | The HTTP API an implementation serves. This site does not serve `/v1` |
| [catalog.json](catalog.json) | Residents, places, and live gates |
| [schemas/](schemas/) | JSON Schemas for the records |

Gates are listed in [gates/registry.json](../gates/registry.json) and read on [gates.html](../gates.html).

Ordinary projects use the operations over HTTP. AIs should eventually call the same operations as an MCP server. No MCP server is running in this version. The live write path is the join-page inbox documented in `operations.json`.
