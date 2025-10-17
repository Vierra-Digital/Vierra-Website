import { prisma } from '../lib/prisma';

async function main() {
    // Create an author
    const author = await prisma.author.create({
        data: {
            name: 'Thomas Walsh',
            email: 'thomas@example.com',
            bio: 'Writer, developer, and coffee enthusiast.',
        },
    });

    // Create a blog post linked to that author
    await prisma.blogPost.create({
        data: {
            author_id: author.id,
            title: 'Hello World Blog Post',
            description: 'A short summary used to verify blog description rendering in hero and cards.',
            content: '<p>This is the very first blog post content. It verifies the new editor, description field, and rendering without images.</p>',
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