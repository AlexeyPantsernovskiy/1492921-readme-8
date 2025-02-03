import { HttpStatus } from '@nestjs/common';

import { BlogPostRdo } from '../rdo/blog-post.rdo';
import { BlogPostError } from '../blog-post.constant';
import { BlogPostWithPaginationRdo } from '../rdo/blog-post-with-pagination.rdo';

export const BlogPostResponse = {
  PostCreated: {
    type: BlogPostRdo,
    status: HttpStatus.CREATED,
    description: 'The new post has been successfully created',
  },
  PostUpdated: {
    type: BlogPostRdo,
    status: HttpStatus.OK,
    description: 'The post has been successfully updated',
  },
  PostDeleted: {
    status: HttpStatus.OK,
    description: 'The post has been successfully deleted',
  },
  PostFound: {
    type: BlogPostRdo,
    status: HttpStatus.OK,
    description: 'Post found',
  },
  PostNotFound: {
    status: HttpStatus.NOT_FOUND,
    description: BlogPostError.PostNotFound,
  },
  PostReposted: {
    type: BlogPostRdo,
    status: HttpStatus.CREATED,
    description: 'The post has been successfully reposted',
  },
  AlreadyReposted: {
    status: HttpStatus.CONFLICT,
    description: BlogPostError.RepostExist,
  },
  PostList: {
    type: BlogPostWithPaginationRdo,
    status: HttpStatus.OK,
    description: 'Post list has been received',
  },
  NotAllow: {
    status: HttpStatus.FORBIDDEN,
    description: BlogPostError.NotAllow,
  },
  PostIsDraft: {
    status: HttpStatus.FORBIDDEN,
    description: BlogPostError.PostIsDraft,
  },

  SearchPosts: {
    type: BlogPostRdo,
    isArray: true,
    status: HttpStatus.OK,
    description: 'Posts searching complete',
  },
  PostsCount: {
    status: HttpStatus.OK,
    description: 'Posts counted',
  },
} as const;
