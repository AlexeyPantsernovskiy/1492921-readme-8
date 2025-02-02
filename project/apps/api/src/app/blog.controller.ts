import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import {
  ApiBearerAuth,
  ApiBody,
  ApiBodyOptions,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { InjectUserIdInterceptor } from '@project/interceptors';
import FormData from 'form-data';
import * as url from 'node:url';

import {
  BlogPostBody,
  BlogPostEntity,
  BlogPostError,
  BlogPostOperation,
  BlogPostParam,
  BlogPostProperty,
  BlogPostResponse,
  CreatePostDto,
} from '@project/blog-post';
import {
  BlogLikeOperationMessage,
  BlogLikeResponseMessage,
} from '@project/blog-like';
import { AuthenticationResponse } from '@project/authentication';
import {
  ImageFileInterceptor,
  multerFileToFormData,
} from '@project/shared-helpers';
import { UploadedFileRdo } from '@project/file-uploader';

import { AxiosExceptionFilter } from './filters/axios-exception.filter';
import { CheckAuthGuard } from './guards/check-auth.guard';
import { ApplicationServiceURL } from './app.config';
import { CheckPublishedPostGuard } from './guards/check-published-post.guard ';
import { CheckMyPostGuard } from './guards/check-my-post.guard';
import { UpdateBlogPostDto } from './dto/update-blog-post.dto';
import { CreatePhotoPostDto } from './dto/create-photo-post.dto';
import { PaginationResult, PostType } from '@project/shared-core';
import { InjectUserIdQueryInterceptor } from './interceptors/inject-user-id-query.interceptor';
import { ApiBlogPostQuery } from './dto/api-blog-post-query';
import { BlogUserEntity } from '@project/blog-user';

function updateApiBodyOptions(
  apiBodyOptions: typeof BlogPostBody.create
): ApiBodyOptions {
  const copy = JSON.parse(JSON.stringify(apiBodyOptions));
  delete copy.examples.photo;
  delete copy.examples.video.value.authorId;
  delete copy.examples.text.value.authorId;
  delete copy.examples.quote.value.authorId;
  delete copy.examples.link.value.authorId;
  return copy;
}
@ApiTags('Blogs')
@Controller('blogs')
@UseFilters(AxiosExceptionFilter)
export class BlogController {
  constructor(private readonly httpService: HttpService) {}

  // Преобразуем tags в массив, предполагая, что разные тэги разделены запятой
  // это из-зи кривости сваггера, которые некорректно работает с массивами
  private tagsToArray(dto) {
    if (typeof dto['tags'] === 'string') {
      const tags: string = dto['tags'];
      if (tags !== '') {
        dto.tags = tags.split(',').map((tag) => tag.trim());
      } else {
        dto.tags = [];
      }
    }
  }

  @Get('posts')
  @ApiOperation(BlogPostOperation.Index)
  @ApiResponse(BlogPostResponse.PostsList)
  @ApiResponse(BlogPostResponse.BadRequest)
  @ApiBearerAuth('accessToken')
  @UseInterceptors(UseInterceptors)
  @UseInterceptors(InjectUserIdQueryInterceptor)
  public async index(@Query() query: ApiBlogPostQuery, @Req() req: Request) {
    const userId = query['userId'];
    const queryString = url.parse(req.url).query;
    const queryParams = userId
      ? `${queryString}&userId=${userId}`
      : queryString;
    const post = await this.httpService.axiosRef.get<
      PaginationResult<BlogPostEntity>
    >(`${ApplicationServiceURL.Blogs}?${queryParams}`, {});

    // Добавляем информацию об авторах к постам
    // По-хорошему я думаю нужно в сервисе блогов хранить минимальные данные об авторах постов
    // и синхронизировать их с сервисом авторизации через RabbitMQ
    for (const postEntity of post.data.entities) {
      try {
        // Получаем информацию об авторе
        const authorResponse =
          await this.httpService.axiosRef.get<BlogUserEntity>(
            `${ApplicationServiceURL.Users}/${postEntity.authorId}`,
            {}
          );

        // Добавляем информацию об авторе к посту
        postEntity['author'] = {
          name: authorResponse.data.name,
          email: authorResponse.data.email,
        };
      } catch (error) {
        postEntity['author'] = {
          name: '--Not found--',
          email: '--Not found--',
        };
        console.error(
          `Failed to fetch author (id = ${postEntity.authorId}) for post ${postEntity.id}:`,
          error.data
        );
      }
    }
    return post.data;
  }

  @Post('posts/photo')
  @ApiOperation(BlogPostOperation.CreatePhoto)
  @ApiResponse(BlogPostResponse.PostCreated)
  @ApiResponse(BlogPostResponse.BadRequest)
  @ApiResponse(AuthenticationResponse.UserNotAuth)
  @ApiBody(BlogPostBody.createPhoto)
  @ApiBearerAuth('accessToken')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(UseInterceptors)
  @UseInterceptors(InjectUserIdInterceptor)
  @UseInterceptors(
    ImageFileInterceptor(BlogPostProperty.PhotoFile.Validate, 'photoFile')
  )
  @UseGuards(CheckAuthGuard)
  public async createPhoto(
    @Body() dto: CreatePhotoPostDto,
    @UploadedFile() photoFile?: Express.Multer.File
  ) {
    this.tagsToArray(dto);
    const form = new FormData();
    if (photoFile) {
      multerFileToFormData(form, photoFile, 'file');
      const { data } = await this.httpService.axiosRef.post<UploadedFileRdo>(
        `${ApplicationServiceURL.Files}/upload`,
        form
      );
      dto['url'] = `${data.subDirectory}/${data.hashName}`;
    }
    const post = await this.httpService.axiosRef.post(
      `${ApplicationServiceURL.Blogs}/`,
      { ...dto, postType: PostType.Photo, authorId: dto['userId'] }
    );
    return post.data;
  }

  @Patch('posts/photo/:postId')
  @ApiOperation(BlogPostOperation.UpdatePhoto)
  @ApiResponse(BlogPostResponse.PostUpdated)
  @ApiResponse(BlogPostResponse.BadRequest)
  @ApiResponse(BlogPostResponse.PostNotFound)
  @ApiResponse(BlogPostResponse.NotAllow)
  @ApiResponse(AuthenticationResponse.UserNotAuth)
  @ApiBody(BlogPostBody.updatePhoto)
  @ApiBearerAuth('accessToken')
  @ApiConsumes('multipart/form-data')
  @ApiParam(BlogPostParam.PostId)
  @UseInterceptors(UseInterceptors)
  @UseInterceptors(InjectUserIdInterceptor)
  @UseInterceptors(
    ImageFileInterceptor(BlogPostProperty.PhotoFile.Validate, 'photoFile')
  )
  @UseGuards(CheckMyPostGuard)
  public async updatePhoto(
    @Param('postId') postId: string,
    @Body() dto: UpdateBlogPostDto,
    @UploadedFile() photoFile?: Express.Multer.File
  ) {
    this.tagsToArray(dto);
    const form = new FormData();
    if (photoFile) {
      multerFileToFormData(form, photoFile, 'file');
      const { data } = await this.httpService.axiosRef.post<UploadedFileRdo>(
        `${ApplicationServiceURL.Files}/upload`,
        form
      );
      dto.url = `${data.subDirectory}/${data.hashName}`;
    }

    const post = await this.httpService.axiosRef.patch(
      `${ApplicationServiceURL.Blogs}/${postId}`,
      { ...dto, postType: PostType.Photo }
    );
    return post.data;
  }

  @Post('posts')
  @ApiOperation(BlogPostOperation.Create)
  @ApiResponse(BlogPostResponse.PostCreated)
  @ApiResponse(BlogPostResponse.BadRequest)
  @ApiResponse(AuthenticationResponse.UserNotAuth)
  @ApiBody(updateApiBodyOptions(BlogPostBody.create))
  @ApiBearerAuth('accessToken')
  @UseInterceptors(UseInterceptors)
  @UseInterceptors(InjectUserIdInterceptor)
  @UseGuards(CheckAuthGuard)
  public async create(@Body() dto: CreatePostDto) {
    const post = await this.httpService.axiosRef.post(
      `${ApplicationServiceURL.Blogs}/`,
      { ...dto, authorId: dto['userId'] }
    );
    return post.data;
  }

  @Patch('posts/:postId')
  @ApiOperation(BlogPostOperation.Update)
  @ApiResponse(BlogPostResponse.PostUpdated)
  @ApiResponse(BlogPostResponse.BadRequest)
  @ApiResponse(BlogPostResponse.PostNotFound)
  @ApiResponse(BlogPostResponse.NotAllow)
  @ApiResponse(AuthenticationResponse.UserNotAuth)
  @ApiBody(BlogPostBody.update)
  @ApiBearerAuth('accessToken')
  @ApiParam(BlogPostParam.PostId)
  @UseInterceptors(UseInterceptors)
  @UseInterceptors(InjectUserIdInterceptor)
  @UseInterceptors(
    ImageFileInterceptor(BlogPostProperty.PhotoFile.Validate, 'photoFile')
  )
  @UseGuards(CheckMyPostGuard)
  public async update(
    @Param('postId') postId: string,
    @Body() dto: UpdateBlogPostDto,
    @UploadedFile() photoFile?: Express.Multer.File
  ) {
    const form = new FormData();
    if (photoFile) {
      multerFileToFormData(form, photoFile, 'file');
      const { data } = await this.httpService.axiosRef.post<UploadedFileRdo>(
        `${ApplicationServiceURL.Files}/upload`,
        form
      );
      dto.url = `${data.subDirectory}/${data.hashName}`;
    }
    const post = await this.httpService.axiosRef.patch(
      `${ApplicationServiceURL.Blogs}/${postId}`,
      dto
    );
    return post.data;
  }

  @Delete('posts/:postId')
  @ApiOperation(BlogPostOperation.Delete)
  @ApiResponse(BlogPostResponse.PostDeleted)
  @ApiResponse(BlogPostResponse.PostNotFound)
  @ApiResponse(BlogPostResponse.NotAllow)
  @ApiBearerAuth('accessToken')
  @ApiParam(BlogPostParam.PostId)
  @HttpCode(BlogPostResponse.PostDeleted.status)
  @UseInterceptors(UseInterceptors)
  @UseInterceptors(InjectUserIdInterceptor)
  @UseGuards(CheckMyPostGuard)
  public async delete(@Param('postId') postId: string) {
    const { data } = await this.httpService.axiosRef.delete(
      `${ApplicationServiceURL.Blogs}/${postId}`,
      null
    );
    return data;
  }

  @Get('posts/:postId')
  @ApiOperation(BlogPostOperation.View)
  @ApiResponse(BlogPostResponse.PostFound)
  @ApiResponse(BlogPostResponse.PostNotFound)
  public async show(@Param('postId') postId: string) {
    const post = await this.httpService.axiosRef.get(
      `${ApplicationServiceURL.Blogs}/${postId}`,
      null
    );
    const { data } = await this.httpService.axiosRef.get(
      `${ApplicationServiceURL.Users}/${post.data.authorId}`,
      null
    );
    return { ...post.data, author: data };
  }

  @Post('posts/:postId/repost')
  @ApiResponse(BlogPostResponse.PostCreated)
  @ApiResponse(BlogPostResponse.BadRequest)
  @ApiResponse(BlogPostResponse.PostNotFound)
  @ApiResponse(AuthenticationResponse.UserNotAuth)
  @ApiBearerAuth('accessToken')
  @ApiParam(BlogPostParam.PostId)
  @UseInterceptors(UseInterceptors)
  @UseInterceptors(InjectUserIdInterceptor)
  @UseGuards(CheckAuthGuard)
  @UseGuards(CheckPublishedPostGuard)
  public async createRepost(@Param('postId') postId: string, @Body() body) {
    const { data } = await this.httpService.axiosRef.post(
      `${ApplicationServiceURL.Blogs}/${postId}/repost`,
      body
    );

    return data;
  }

  @Post('posts/:postId/likes')
  @ApiOperation({ summary: BlogLikeOperationMessage.SetLike })
  @ApiResponse({
    status: HttpStatus.OK,
    description: BlogLikeResponseMessage.SetLike,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: BlogLikeResponseMessage.Unauthorized,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: BlogLikeResponseMessage.PostNotFound,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: BlogLikeResponseMessage.LikeExists,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: BlogPostError.PostIsDraft,
  })
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('accessToken')
  @UseInterceptors(UseInterceptors)
  @UseInterceptors(InjectUserIdInterceptor)
  @UseGuards(CheckAuthGuard)
  @UseGuards(CheckPublishedPostGuard)
  public async addLike(@Param('postId') postId: string, @Body() body) {
    const { data } = await this.httpService.axiosRef.post(
      `${ApplicationServiceURL.Blogs}/${postId}/likes`,
      body
    );

    return data;
  }

  @Delete('posts/:postId/likes')
  @ApiOperation({ summary: BlogLikeOperationMessage.DelLike })
  @UseGuards(CheckAuthGuard)
  @UseGuards(CheckPublishedPostGuard)
  @ApiBearerAuth('accessToken')
  @UseInterceptors(UseInterceptors)
  @UseInterceptors(InjectUserIdInterceptor)
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: BlogLikeResponseMessage.DelLike,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: BlogLikeResponseMessage.Unauthorized,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: BlogLikeResponseMessage.PostNotFound,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: BlogLikeResponseMessage.LikeNotFound,
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  public async deleteLike(@Param('postId') postId: string, @Body() dto) {
    const { data } = await this.httpService.axiosRef.delete(
      `${ApplicationServiceURL.Blogs}/${postId}/likes`,
      { data: dto }
    );
    return data;
  }
}
