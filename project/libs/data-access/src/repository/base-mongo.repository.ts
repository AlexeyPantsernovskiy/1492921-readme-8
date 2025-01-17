import { Document, Model } from 'mongoose';
import { NotFoundException } from '@nestjs/common';

import { Entity, StorableEntity, EntityFactory } from '@project/shared-types';
import { Repository } from './repository.interface';

export abstract class BaseMongoRepository<
  T extends Entity & StorableEntity<ReturnType<T['toPOJO']>>,
  DocumentType extends Document,
> implements Repository<T>
{
  constructor(
    protected entityFactory: EntityFactory<T>,
    protected readonly model: Model<DocumentType>
  ) {}

  protected createEntityFromDocument(document: DocumentType): T | null {
    if (!document) {
      return null;
    }

    const plainObject = document.toObject({
      getters: true,
      flattenObjectIds: true,
      versionKey: false,
    }) as ReturnType<T['toPOJO']>;
    return this.entityFactory.create(plainObject);
  }

  public async findById(id: T['id']): Promise<T> {
    if (!id) {
      return null;
    }
    const document = await this.model.findById(id).exec();
    return this.createEntityFromDocument(document);
  }

  public async save(entity: T): Promise<T> {
    const newEntity = new this.model(entity.toPOJO());
    await newEntity.save();
    return this.createEntityFromDocument(newEntity);
  }

  public async update(entity: T): Promise<T> {
    const updatedDocument = await this.model
      .findByIdAndUpdate(entity.id, entity.toPOJO(), {
        new: true,
        runValidators: true,
      })
      .exec();

    if (!updatedDocument) {
      throw new NotFoundException(`Entity with id ${entity.id} not found`);
    }
    return this.createEntityFromDocument(updatedDocument);
  }

  public async deleteById(id: T['id']): Promise<void> {
    const deletedDocument = await this.model.findByIdAndDelete(id).exec();
    if (!deletedDocument) {
      throw new NotFoundException(`Entity with id ${id} not found.`);
    }
  }
}
