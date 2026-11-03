import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Book } from '../books/book.entity';
import { Order } from './order.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Order, (o) => o.items, { onDelete: 'CASCADE' })
  order: Order;

  @ManyToOne(() => Book, { eager: true, onDelete: 'RESTRICT' })
  book: Book;

  @Column({ type: 'int' })
  quantity: number;

  // Luu gia tai thoi diem mua, tranh bi doi khi sach doi gia
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  unitPrice: number;
}
