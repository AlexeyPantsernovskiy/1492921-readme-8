import { Module } from '@nestjs/common';

import { BlogPostModule } from '@project/blog-post';

import { BlogLikeFactory } from './blog-like.factory';
import { BlogLikeRepository } from './blog-like.repository';
import { BlogLikeService } from './blog-like.service';

@Module({
  imports: [BlogPostModule],
  providers: [BlogLikeService, BlogLikeFactory, BlogLikeRepository],
  exports: [BlogLikeService],
})
export class BlogLikeModule {}