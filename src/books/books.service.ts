import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Book } from './book.entity';
import { CreateBookDto, QueryBookDto, UpdateBookDto } from './book.dto';

@Injectable()
export class BooksService {
  constructor(@InjectRepository(Book) private readonly repo: Repository<Book>) {}

  async findAll(q: QueryBookDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 12;

    const qb = this.repo
      .createQueryBuilder('book')
      .leftJoinAndSelect('book.category', 'category')
      .orderBy('book.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (q.search) {
      qb.andWhere('(book.title LIKE :s OR book.author LIKE :s)', {
        s: `%${q.search}%`,
      });
    }
    if (q.categoryId) {
      qb.andWhere('category.id = :cid', { cid: q.categoryId });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async findOne(id: number) {
    const book = await this.repo.findOne({ where: { id } });
    if (!book) throw new NotFoundException('Khong tim thay sach');
    return book;
  }

  create(dto: CreateBookDto) {
    const { categoryId, ...rest } = dto;
    return this.repo.save(
      this.repo.create({
        ...rest,
        category: categoryId ? ({ id: categoryId } as any) : null,
      }),
    );
  }

  async update(id: number, dto: UpdateBookDto) {
    const book = await this.findOne(id);
    const { categoryId, ...rest } = dto;
    Object.assign(book, rest);
    if (categoryId !== undefined) {
      book.category = categoryId ? ({ id: categoryId } as any) : null;
    }
    return this.repo.save(book);
  }

  async remove(id: number) {
    const book = await this.findOne(id);
    await this.repo.remove(book);
    return { deleted: true };
  }
}
