import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class TransactionRepository {
  constructor(private readonly prisma: PrismaService) {}
  /**
   * Create transaction
   * @returns
   */
  async createTransaction({
    booking_id,
    amount,
    currency,
    reference_number,
    status = 'pending',
  }: {
    booking_id: string;
    amount?: number;
    currency?: string;
    reference_number?: string;
    status?: string;
  }) {
    const data = {};
    if (booking_id) {
      data['booking_id'] = booking_id;
    }
    if (amount) {
      data['amount'] = Number(amount);
    }
    if (currency) {
      data['currency'] = currency;
    }
    if (reference_number) {
      data['reference_number'] = reference_number;
    }
    if (status) {
      data['status'] = status;
    }
    return await this.prisma.paymentTransaction.create({
      data: {
        ...data,
      },
    });
  }

  /**
   * Update transaction
   * @returns
   */
  async updateTransaction({
    reference_number,
    status = 'pending',
    paid_amount,
    paid_currency,
    raw_status,
  }: {
    reference_number: string;
    status: string;
    paid_amount?: number;
    paid_currency?: string;
    raw_status?: string;
  }) {
    const data = {};
    const order_data = {};
    if (status) {
      data['status'] = status;
      order_data['payment_status'] = status;
    }
    if (paid_amount) {
      data['paid_amount'] = Number(paid_amount);
      order_data['paid_amount'] = Number(paid_amount);
    }
    if (paid_currency) {
      data['paid_currency'] = paid_currency;
      order_data['paid_currency'] = paid_currency;
    }
    if (raw_status) {
      data['raw_status'] = raw_status;
      order_data['payment_raw_status'] = raw_status;
    }

    const paymentTransaction = await this.prisma.paymentTransaction.findMany({
      where: {
        reference_number: reference_number,
      },
    });

    // update booking status
    // if (paymentTransaction.length > 0) {
    //   await prisma.order.update({
    //     where: {
    //       id: paymentTransaction[0].order_id,
    //     },
    //     data: {
    //       ...order_data,
    //     },
    //   });
    // }

    return await this.prisma.paymentTransaction.updateMany({
      where: {
        reference_number: reference_number,
      },
      data: {
        ...data,
      },
    });
  }
}
