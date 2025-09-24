import { prisma } from '../lib/prisma';

async function main() {
    // Create an author
    const author = await prisma.author.create({
        data: {
            name: 'Thomas Walsh',
            email: 'thomas@example.com',
            bio: 'Writer, developer, and coffee enthusiast.',
            is_test: true
        },
    });

    // Create a blog post linked to that author
    await prisma.blogPost.create({
        data: {
            author_id: author.id,
            title: 'Hello World Blog Post',
            content: '<p>This is the very first blog post content.</p>',
            image_url: '/assets/paul',
            slug: 'hello-world-blog-post',
            is_test: true,
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