import { prisma } from '../lib/prisma';

async function main() {
    // Create an author
    const author = await prisma.authors.create({
        data: {
            name: 'Thomas Walsh',
            email: 'thomas@example.com',
            bio: 'Writer, developer, and coffee enthusiast.',
        },
    });

    // Create a blog post linked to that author
    await prisma.blog_posts.create({
        data: {
            author_id: author.id,
            title: 'Hello World Blog Post',
            content: '<p>This is the very first blog post content.</p>',
            image_url: 'https://via.placeholder.com/800x400',
            slug: 'hello-world-blog-post',
        },
    });

    console.log('Seed data inserted!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });