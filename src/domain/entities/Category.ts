export class Category {
    private readonly name: string;

    constructor(name: string) {
        this.name = name.trim();
        this.validate();
    }

    private validate() {
        if (!this.name) throw new Error("Category name is required.");
    }
}