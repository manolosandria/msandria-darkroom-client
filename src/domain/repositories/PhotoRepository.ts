import { Photo } from './../entities/Photo';

export type NewPhotoInput = {
    file: File;
    title: string;
    description?: string;
};

export interface PhotoRepository {
    findById(id: string): Promise<Photo | null>;
    save(input: NewPhotoInput): Promise<Photo>;
    delete(id: string): Promise<void>;
    findAll(): Promise<Photo[] | null>;
    findCollection(id: string): Promise<Photo[] | null>;
}
