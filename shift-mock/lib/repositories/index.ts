// 画面から使うデータアクセスの入口。
// 本番化: firestore.ts に Repositories を実装し、下の 1 行を差し替える。
import { mockRepositories } from "./mock";
import type { Repositories } from "./types";

export const repo: Repositories = mockRepositories;
export type { Repositories };
