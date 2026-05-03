export class SocialLink {
    constructor(name, url) {
        this.name = name;
        this.url = url;
    }

    toString() {
        return `<a href="${this.url}">${this.name}</a>`;
    }

    get link() {
        return this.toString();
    }
}
