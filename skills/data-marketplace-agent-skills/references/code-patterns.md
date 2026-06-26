# Code Patterns

Use server-side helpers. Keep the provided API Reference as the source for exact request details.

## TypeScript Server Helper

```ts
type DataProductValue = string | number | boolean | undefined;
type DataProductBody = {
  filters?: Record<string, DataProductValue>;
  fields?: string[];
  bbox?: {
    min_lat: number;
    max_lat: number;
    min_lng: number;
    max_lng: number;
  };
  sort?: {
    field: string;
    order: "asc" | "desc";
  };
  limit?: number;
  offset?: number;
};

type DataProductResponse<T> = {
  success: boolean;
  data: T[];
  row_count: number;
  limit: number;
  offset: number;
  has_next: boolean;
};

export async function callDataProduct<T>(
  productId: string,
  body: DataProductBody,
): Promise<DataProductResponse<T>> {
  const res = await fetch(
    `${process.env.DATA_MARKETPLACE_BASE_URL}/api/v1/data-products/${productId}/call`,
    {
      method: "POST",
      headers: {
        "X-API-KEY": process.env.DATA_MARKETPLACE_API_KEY ?? "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    throw new Error(`Data Product call failed: ${res.status}`);
  }
  return (await res.json()) as DataProductResponse<T>;
}
```

Read rows from the common response wrapper:

```ts
const result = await callDataProduct<Row>(productId, body);
const rows = result.data;
```

## Body Builder Rules

- Put supported search filters in `body.filters`.
- Put bbox in top-level `body.bbox`.
- Put `fields` in `body.fields` as a string array.
- Use `limit` and `offset` for map/list calls.
- For potentially large list calls, expose `limit` and `offset` in the server helper input and return pagination metadata to the caller.
- Do not fetch every page automatically for initial render; load the first page and continue only when the UI asks for more.
- Keep ID values as strings from route params through API calls.

## Map Bbox Marker Helper Guardrail

For a current-viewport residential marker helper, use the residential type marker product role and read its exact `product_id` from the API Reference. Build a `POST /api/v1/data-products/{product_id}/call` request with top-level `bbox`, `limit`, `offset`, and docs-validated `fields` in the JSON Body.

Do not flatten bbox or filters into URL query parameters. Authenticate only with the server-side `X-API-KEY` header. Preserve `limit` and `offset` in the helper input/output so callers can paginate dense map responses.

## Browser Boundary

- Browser components call your server route, not Data Marketplace directly.
- Server routes read `DATA_MARKETPLACE_API_KEY`.
- Do not log API keys, request headers, or decrypted source configuration.
