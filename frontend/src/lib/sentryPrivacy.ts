import type { DataCollection } from "@sentry/core";

/** Error reports carry the error and the page, nothing about the person. */
export const PRIVATE: DataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
};
