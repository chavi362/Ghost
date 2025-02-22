const assert = require('assert/strict');
const {
    agentProvider,
    fixtureManager,
    mockManager,
    matchers
} = require('../../utils/e2e-framework');
const {
    anyContentVersion,
    anyEtag,
    anyErrorId,
    anyLocationFor,
    anyObjectId,
    anyISODateTime,
    anyNumber,
    anyString,
    anyUuid,
    anyArray,
    anyObject
} = matchers;

const matchCollection = {
    id: anyObjectId,
    created_at: anyISODateTime,
    updated_at: anyISODateTime
};

const tierSnapshot = {
    id: anyObjectId,
    created_at: anyISODateTime,
    updated_at: anyISODateTime
};

const tagSnapshotMatcher = {
    id: anyObjectId,
    created_at: anyISODateTime,
    updated_at: anyISODateTime
};

const matchPostShallowIncludes = {
    id: anyObjectId,
    uuid: anyUuid,
    comment_id: anyString,
    url: anyString,
    authors: anyArray,
    primary_author: anyObject,
    tags: Array(2).fill(tagSnapshotMatcher),
    primary_tag: anyObject,
    tiers: Array(2).fill(tierSnapshot),
    created_at: anyISODateTime,
    updated_at: anyISODateTime,
    published_at: anyISODateTime,
    post_revisions: anyArray
};

/**
 *
 * @param {number} postCount
 */
const buildMatcher = (postCount, opts = {}) => {
    let obj = {
        id: anyObjectId
    };
    if (opts.withSortOrder) {
        obj.sort_order = anyNumber;
    }
    return {
        ...matchCollection,
        posts: Array(postCount).fill(obj)
    };
};

describe('Collections API', function () {
    let agent;

    before(async function () {
        mockManager.mockLabsEnabled('collections');
        agent = await agentProvider.getAdminAPIAgent();
        await fixtureManager.init('users', 'posts');
        await agent.loginAsOwner();
    });

    afterEach(function () {
        mockManager.restore();
    });

    it('Can add a Collection', async function () {
        const collection = {
            title: 'Test Collection',
            description: 'Test Collection Description'
        };

        await agent
            .post('/collections/')
            .body({
                collections: [collection]
            })
            .expectStatus(201)
            .matchHeaderSnapshot({
                'content-version': anyContentVersion,
                etag: anyEtag,
                location: anyLocationFor('collections')
            })
            .matchBodySnapshot({
                collections: [matchCollection]
            });
    });

    describe('Browse', function () {
        it('Can browse Collections', async function () {
            await agent
                .get('/collections/')
                .expectStatus(200)
                .matchHeaderSnapshot({
                    'content-version': anyContentVersion,
                    etag: anyEtag
                })
                .matchBodySnapshot({
                    collections: [
                        buildMatcher(13, {withSortOrder: true}),
                        buildMatcher(2, {withSortOrder: true}),
                        buildMatcher(0)
                    ]
                });
        });
    });

    it('Can read a Collection by id and slug', async function () {
        const collection = {
            title: 'Test Collection to Read'
        };

        const addResponse = await agent
            .post('/collections/')
            .body({
                collections: [collection]
            })
            .expectStatus(201)
            .matchHeaderSnapshot({
                'content-version': anyContentVersion,
                etag: anyEtag,
                location: anyLocationFor('collections')
            })
            .matchBodySnapshot({
                collections: [matchCollection]
            });

        const collectionId = addResponse.body.collections[0].id;

        const readResponse = await agent
            .get(`/collections/${collectionId}/`)
            .expectStatus(200)
            .matchHeaderSnapshot({
                'content-version': anyContentVersion,
                etag: anyEtag
            })
            .matchBodySnapshot({
                collections: [matchCollection]
            });

        assert.equal(readResponse.body.collections[0].title, 'Test Collection to Read');

        const collectionSlug = addResponse.body.collections[0].slug;
        const readBySlugResponse = await agent
            .get(`/collections/slug/${collectionSlug}/`)
            .expectStatus(200)
            .matchHeaderSnapshot({
                'content-version': anyContentVersion,
                etag: anyEtag
            })
            .matchBodySnapshot({
                collections: [matchCollection]
            });

        assert.equal(readBySlugResponse.body.collections[0].title, 'Test Collection to Read');

        await agent
            .delete(`/collections/${collectionId}/`)
            .expectStatus(204);
    });

    describe('Edit', function () {
        let collectionToEdit;

        before(async function () {
            const collection = {
                title: 'Test Collection to Edit'
            };

            const addResponse = await agent
                .post('/collections/')
                .body({
                    collections: [collection]
                })
                .expectStatus(201);

            collectionToEdit = addResponse.body.collections[0];
        });

        it('Can edit a Collection', async function () {
            const editResponse = await agent
                .put(`/collections/${collectionToEdit.id}/`)
                .body({
                    collections: [{
                        title: 'Test Collection Edited'
                    }]
                })
                .expectStatus(200)
                .matchHeaderSnapshot({
                    'content-version': anyContentVersion,
                    etag: anyEtag
                })
                .matchBodySnapshot({
                    collections: [matchCollection]
                });

            assert.equal(editResponse.body.collections[0].title, 'Test Collection Edited');
        });

        it('Fails to edit unexistent Collection', async function () {
            const unexistentID = '5951f5fca366002ebd5dbef7';
            await agent
                .put(`/collections/${unexistentID}/`)
                .body({
                    collections: [{
                        id: unexistentID,
                        title: 'Editing unexistent Collection'
                    }]
                })
                .expectStatus(404)
                .matchBodySnapshot({
                    errors: [{
                        id: anyErrorId
                    }]
                })
                .matchHeaderSnapshot({
                    'content-version': anyContentVersion,
                    etag: anyEtag
                });
        });
    });

    it('Can delete a Collection', async function () {
        const collection = {
            title: 'Test Collection to Delete'
        };

        const addResponse = await agent
            .post('/collections/')
            .body({
                collections: [collection]
            })
            .expectStatus(201)
            .matchHeaderSnapshot({
                'content-version': anyContentVersion,
                etag: anyEtag,
                location: anyLocationFor('collections')
            })
            .matchBodySnapshot({
                collections: [matchCollection]
            });

        const collectionId = addResponse.body.collections[0].id;

        await agent
            .delete(`/collections/${collectionId}/`)
            .expectStatus(204)
            .matchHeaderSnapshot({
                'content-version': anyContentVersion,
                etag: anyEtag
            })
            .matchBodySnapshot();

        await agent
            .get(`/collections/${collectionId}/`)
            .expectStatus(404)
            .matchHeaderSnapshot({
                'content-version': anyContentVersion,
                etag: anyEtag
            })
            .matchBodySnapshot({
                errors: [{
                    id: anyErrorId
                }]
            });
    });

    it('Cannot delete a built in collection', async function () {
        const builtInCollection = await agent
            .get('/collections/?filter=slug:featured')
            .expectStatus(200);

        assert.ok(builtInCollection.body.collections);
        assert.equal(builtInCollection.body.collections.length, 1);

        await agent
            .delete(`/collections/${builtInCollection.body.collections[0].id}/`)
            .expectStatus(405)
            .matchHeaderSnapshot({
                'content-version': anyContentVersion,
                etag: anyEtag
            })
            .matchBodySnapshot({
                errors: [{
                    id: anyErrorId,
                    context: anyString
                }]
            });
    });

    describe('Automatic Collection Filtering', function () {
        it('Creates an automatic Collection with a featured filter', async function () {
            const collection = {
                title: 'Test Featured Collection',
                description: 'Test Collection Description',
                type: 'automatic',
                filter: 'featured:true'
            };

            await agent
                .post('/collections/')
                .body({
                    collections: [collection]
                })
                .expectStatus(201)
                .matchHeaderSnapshot({
                    'content-version': anyContentVersion,
                    etag: anyEtag,
                    location: anyLocationFor('collections')
                })
                .matchBodySnapshot({
                    collections: [buildMatcher(2)]
                });
        });

        it('Creates an automatic Collection with a published_at filter', async function () {
            const collection = {
                title: 'Test Collection with published_at filter',
                description: 'Test Collection Description with published_at filter',
                type: 'automatic',
                filter: 'published_at:>=2022-05-25'
            };

            await agent
                .post('/collections/')
                .body({
                    collections: [collection]
                })
                .expectStatus(201)
                .matchHeaderSnapshot({
                    'content-version': anyContentVersion,
                    etag: anyEtag,
                    location: anyLocationFor('collections')
                })
                .matchBodySnapshot({
                    collections: [buildMatcher(9)]
                });
        });

        it('Creates an automatic Collection with a tags filter', async function () {
            const collection = {
                title: 'Test Collection with tags filter',
                slug: 'bacon',
                description: 'BACON!',
                type: 'automatic',
                filter: 'tags:[\'bacon\']'
            };

            await agent
                .post('/collections/')
                .body({
                    collections: [collection]
                })
                .expectStatus(201)
                .matchHeaderSnapshot({
                    'content-version': anyContentVersion,
                    etag: anyEtag,
                    location: anyLocationFor('collections')
                })
                .matchBodySnapshot({
                    collections: [buildMatcher(2)]
                });

            await agent.get(`posts/?collection=${collection.slug}`)
                .expectStatus(200)
                .matchHeaderSnapshot({
                    'content-version': anyContentVersion,
                    etag: anyEtag
                })
                .matchBodySnapshot({
                    posts: new Array(2).fill(matchPostShallowIncludes)
                });
        });

        it('Creates an automatic Collection with a tag filter, checking filter aliases', async function () {
            const collection = {
                title: 'Test Collection with tag filter alias',
                slug: 'bacon-tag-expansion',
                description: 'BACON!',
                type: 'automatic',
                filter: 'tag:[\'bacon\']'
            };

            await agent
                .post('/collections/')
                .body({
                    collections: [collection]
                })
                .expectStatus(201)
                .matchHeaderSnapshot({
                    'content-version': anyContentVersion,
                    etag: anyEtag,
                    location: anyLocationFor('collections')
                })
                .matchBodySnapshot({
                    collections: [buildMatcher(2)]
                });

            await agent.get(`posts/?collection=${collection.slug}`)
                .expectStatus(200)
                .matchHeaderSnapshot({
                    'content-version': anyContentVersion,
                    etag: anyEtag
                })
                .matchBodySnapshot({
                    posts: new Array(2).fill(matchPostShallowIncludes)
                });
        });
    });
});
