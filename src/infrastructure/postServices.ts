import { BrowsePosts } from "../application/use-cases/BrowsePosts";
import { ManagePosts } from "../application/use-cases/ManagePosts";
import { ApiPostRepository } from "./ApiPostRepository";

// Next.js inlines NEXT_PUBLIC_* at build time, so it must be set before building.
const postRepository = new ApiPostRepository(process.env.NEXT_PUBLIC_API_URL);
export const browsePosts = new BrowsePosts(postRepository);
export const managePosts = new ManagePosts(postRepository);
