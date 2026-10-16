import { EditCatalog } from "../application/use-cases/EditCatalog";
import { ApiCatalogRepository } from "./ApiCatalogRepository";
export const editCatalog = new EditCatalog(
  new ApiCatalogRepository(process.env.NEXT_PUBLIC_API_URL),
);
