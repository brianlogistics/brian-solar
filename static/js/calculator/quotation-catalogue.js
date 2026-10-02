const QuotationCatalogue = {

    version: "1.0.0",

    data: null,

    loaded: false,

    error: null,

    async load(
        url = "/static/data/quotation-catalogue.json"
    ) {
        this.error = null;
        this.loaded = false;

        try {
            const response =
                await fetch(url, {
                    cache: "no-store"
                });

            if (!response.ok) {
                throw new Error(
                    `Catalogue request failed with HTTP ${response.status}.`
                );
            }

            const data =
                await response.json();

            this.validate(data);

            this.data = data;
            this.loaded = true;

            return data;

        } catch (error) {

            this.data = null;
            this.loaded = false;
            this.error = error;

            throw error;
        }
    },

    validate(data) {

        if (
            !data ||
            typeof data !== "object"
        ) {
            throw new Error(
                "Quotation catalogue must be an object."
            );
        }

        if (
            !Array.isArray(data.products)
        ) {
            throw new Error(
                "Quotation catalogue products must be an array."
            );
        }

        if (
            !Array.isArray(data.materials)
        ) {
            throw new Error(
                "Quotation catalogue materials must be an array."
            );
        }

        if (
            !Array.isArray(data.services)
        ) {
            throw new Error(
                "Quotation catalogue services must be an array."
            );
        }

        return true;
    },

    getProducts() {

        return this.data &&
            Array.isArray(this.data.products)
            ? this.data.products
            : [];
    },

    getMaterials() {

        return this.data &&
            Array.isArray(this.data.materials)
            ? this.data.materials
            : [];
    },

    getServices() {

        return this.data &&
            Array.isArray(this.data.services)
            ? this.data.services
            : [];
    },

    findById(
        collection,
        id
    ) {

        if (
            !Array.isArray(collection) ||
            !id
        ) {
            return null;
        }

        return (
            collection.find(
                item =>
                    item &&
                    item.id === id
            ) || null
        );
    },

    getProductById(id) {

        return this.findById(
            this.getProducts(),
            id
        );
    },

    getMaterialById(id) {

        return this.findById(
            this.getMaterials(),
            id
        );
    },

    getServiceById(id) {

        return this.findById(
            this.getServices(),
            id
        );
    },

    findByCategory(
        collection,
        category
    ) {

        if (
            !Array.isArray(collection) ||
            !category
        ) {
            return [];
        }

        return collection.filter(
            item =>
                item &&
                item.category === category
        );
    },

    getProductsByCategory(category) {

        return this.findByCategory(
            this.getProducts(),
            category
        );
    },

    getMaterialsByCategory(category) {

        return this.findByCategory(
            this.getMaterials(),
            category
        );
    },

    getServicesByCategory(category) {

        return this.findByCategory(
            this.getServices(),
            category
        );
    },

    getSettings() {

        return this.data &&
            this.data.settings &&
            typeof this.data.settings === "object"
            ? this.data.settings
            : {};
    }
};