export default function buildBookshelf(books = []) {
  const slugs = new Set();
  for (const book of books) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(book.slug) || slugs.has(book.slug)) {
      throw new Error(`Book reviews need unique URL-safe slugs: ${book.slug}`);
    }
    if (!book.title || !book.author || !book.review || !book.genre) {
      throw new Error(`Book review is incomplete: ${book.slug}`);
    }
    if (book.rating !== null && (!Number.isInteger(book.rating) || book.rating < 1 || book.rating > 5)) {
      throw new Error(`Book rating must be null or an integer from 1 to 5: ${book.slug}`);
    }
    if (new URL(book.url).protocol !== "https:") {
      throw new Error(`Book details must use HTTPS: ${book.slug}`);
    }
    slugs.add(book.slug);
  }

  return {
    books: [...books].reverse(),
    genres: [...new Set(books.map(({ genre }) => genre))]
      .sort((a, b) => a.localeCompare(b, "en")),
  };
}
