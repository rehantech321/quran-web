import { useEffect, useState } from "react";

import { apiClient } from "@/lib/apiClient";

/** Fetches an authenticated PNG for each id and hands back a map of id -> blob object URL. */
export function useBlobObjectUrls(
  urlForId: (id: string) => string,
  ids: string[],
): Map<string, string> {
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const idsKey = ids.join(",");

  useEffect(() => {
    if (ids.length === 0) return;
    let cancelled = false;
    const objectUrls: string[] = [];

    Promise.all(
      ids.map(async (id) => {
        const res = await apiClient.get<ArrayBuffer>(urlForId(id), {
          responseType: "arraybuffer",
        });
        const objectUrl = URL.createObjectURL(
          new Blob([res.data], { type: "image/png" }),
        );
        objectUrls.push(objectUrl);
        return [id, objectUrl] as const;
      }),
    ).then((pairs) => {
      if (!cancelled) setUrls(new Map(pairs));
    });

    return () => {
      cancelled = true;
      for (const url of objectUrls) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- idsKey is the intentional dep, not `ids`/`urlForId`
  }, [idsKey]);

  return urls;
}
