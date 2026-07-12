import { Photo } from './../entities/Photo';

export interface PhotoRepository {
    findById(id: string): Promise<Photo | null>;
    save(photo: Photo): Promise<void>;
    delete(id: string): Promise<void>;
    findAll(): Promise<Photo[]>;
    findCollection(id: string): Promise<Photo[] | null>;
}
