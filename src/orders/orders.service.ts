import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Book } from '../books/book.entity';
import { Role } from '../users/user.entity';
import { CreateOrderDto } from './order.dto';
import { OrderItem } from './order-item.entity';
import { Order, OrderStatus } from './order.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // Dat hang trong 1 transaction: kiem tra ton kho, tru kho, tinh tong tien
  async create(userId: number, dto: CreateOrderDto) {
    return this.dataSource.transaction(async (em) => {
      const order = new Order();
      order.user = { id: userId } as any;
      order.shippingAddress = dto.shippingAddress;
      order.items = [];
      let total = 0;

      for (const line of dto.items) {
        const book = await em.findOne(Book, {
          where: { id: line.bookId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!book) {
          throw new NotFoundException(`Khong tim thay sach id=${line.bookId}`);
        }
        if (book.stock < line.quantity) {
          throw new BadRequestException(
            `Sach "${book.title}" chi con ${book.stock} cuon`,
          );
        }
        book.stock -= line.quantity;
        await em.save(book);

        const item = new OrderItem();
        item.book = book;
        item.quantity = line.quantity;
        item.unitPrice = Number(book.price);
        order.items.push(item);
        total += Number(book.price) * line.quantity;
      }

      order.totalAmount = total;
      return em.save(order);
    });
  }

  findMine(userId: number) {
    return this.orders.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  findAll() {
    return this.orders.find({
      relations: { user: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number, user: { id: number; role: string }) {
    const order = await this.orders.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!order) throw new NotFoundException('Khong tim thay don hang');
    if (user.role !== Role.Admin && order.user.id !== user.id) {
      throw new ForbiddenException('Ban khong co quyen xem don hang nay');
    }
    return order;
  }

  async updateStatus(id: number, status: OrderStatus) {
    const order = await this.orders.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Khong tim thay don hang');
    order.status = status;
    return this.orders.save(order);
  }
}
