import stripe from 'stripe';
import * as fs from 'fs';
import appConfig from '../../../../config/app.config';
import { Fetch } from '../../Fetch';
import * as dotenv from 'dotenv';
dotenv.config();

const STRIPE_SECRET_KEY = appConfig().payment.stripe.secret_key;

const Stripe = new stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2025-03-31.basil',
});

const STRIPE_WEBHOOK_SECRET = appConfig().payment.stripe.webhook_secret;
/**
 * Stripe payment method helper
 */
export class StripePayment {
  static async createPaymentMethod({
    card,
    billing_details,
  }: {
    card: stripe.PaymentMethodCreateParams.Card;
    billing_details: stripe.PaymentMethodCreateParams.BillingDetails;
  }): Promise<stripe.PaymentMethod> {
    const paymentMethod = await Stripe.paymentMethods.create({
      card: {
        number: card.number,
        exp_month: card.exp_month,
        exp_year: card.exp_year,
        cvc: card.cvc,
      },
      billing_details: billing_details,
    });
    return paymentMethod;
  }

  /**
   * Add customer to stripe
   * @param email
   * @returns
   */
  static async createCustomer({
    user_id,
    name,
    email,
  }: {
    user_id: string;
    name: string;
    email: string;
  }): Promise<stripe.Customer> {
    const customer = await Stripe.customers.create({
      name: name,
      email: email,
      metadata: {
        user_id: user_id,
      },
      description: 'New Customer',
    });
    return customer;
  }

  static async attachCustomerPaymentMethodId({
    customer_id,
    payment_method_id,
  }: {
    customer_id: string;
    payment_method_id: string;
  }): Promise<stripe.PaymentMethod> {
    const customer = await Stripe.paymentMethods.attach(payment_method_id, {
      customer: customer_id,
    });
    return customer;
  }

  static async setCustomerDefaultPaymentMethodId({
    customer_id,
    payment_method_id,
  }: {
    customer_id: string;
    payment_method_id: string;
  }): Promise<stripe.Customer> {
    const customer = await Stripe.customers.update(customer_id, {
      invoice_settings: {
        default_payment_method: payment_method_id,
      },
    });
    return customer;
  }

  static async updateCustomer({
    customer_id,
    name,
    email,
  }: {
    customer_id: string;
    name: string;
    email: string;
  }): Promise<stripe.Customer> {
    const customer = await Stripe.customers.update(customer_id, {
      name: name,
      email: email,
    });
    return customer;
  }

  /**
   * Get customer using id
   * @param id
   * @returns
   */
  static async getCustomerByID(id: string): Promise<stripe.Customer> {
    const customer = await Stripe.customers.retrieve(id);
    return customer as stripe.Customer;
  }

  /**
   * Create billing portal session
   * @param customer
   * @returns
   */
  static async createBillingSession(customer: string) {
    const session = await Stripe.billingPortal.sessions.create({
      customer: customer,
      return_url: appConfig().app.url,
    });
    return session;
  }

  static async createPaymentIntent({
    amount,
    currency,
    customer_id,
    metadata,
  }: {
    amount: number;
    currency: string;
    customer_id: string;
    metadata?: stripe.MetadataParam;
  }): Promise<stripe.PaymentIntent> {
    return Stripe.paymentIntents.create({
      amount: amount * 100, // amount in cents
      currency: currency,
      customer: customer_id,
      metadata: metadata,
    });
  }

  /**
   * Create stripe hosted checkout session
   * @param customer
   * @param price
   * @returns
   */
  static async createCheckoutSession() {
    const success_url = `${
      appConfig().app.url
    }/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancel_url = `${appConfig().app.url}/failed`;

    const session = await Stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Sample Product',
            },
            unit_amount: 2000, // $20.00
          },
          quantity: 1,
        },
      ],

      success_url: success_url,
      cancel_url: cancel_url,
      // automatic_tax: { enabled: true },
    });
    return session;
  }

  /**
   * Create stripe hosted checkout session
   * @param customer
   * @param price
   * @returns
   */
  static async createCheckoutSessionSubscription(
    customer: string,
    price: string,
  ) {
    const success_url = `${
      appConfig().app.url
    }/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancel_url = `${appConfig().app.url}/failed`;

    const session = await Stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer: customer,
      line_items: [
        {
          price: price,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 14,
      },
      success_url: success_url,
      cancel_url: cancel_url,
      // automatic_tax: { enabled: true },
    });
    return session;
  }

  /**
   * Calculate taxes
   * @param amount
   * @returns
   */
  static async calculateTax({
    amount,
    currency,
    customer_details,
  }: {
    amount: number;
    currency: string;
    customer_details: stripe.Tax.CalculationCreateParams.CustomerDetails;
  }): Promise<stripe.Tax.Calculation> {
    const taxCalculation = await Stripe.tax.calculations.create({
      currency: currency,
      customer_details: customer_details,
      line_items: [
        {
          amount: amount * 100,
          tax_behavior: 'exclusive',
          reference: 'tax_calculation',
        },
      ],
    });
    return taxCalculation;
  }

  // create a tax transaction
  static async createTaxTransaction(
    tax_calculation: string,
  ): Promise<stripe.Tax.Transaction> {
    const taxTransaction = await Stripe.tax.transactions.createFromCalculation({
      calculation: tax_calculation,
      reference: 'tax_transaction',
    });
    return taxTransaction;
  }

  // download invoice using payment intent id
  static async downloadInvoiceUrl(
    payment_intent_id: string,
  ): Promise<string | null> {
    const invoice = await Stripe.invoices.retrieve(payment_intent_id);
    // check if the invoice has  areceipt url
    if (invoice.hosted_invoice_url) {
      return invoice.hosted_invoice_url;
    }
    return null;
  }

  // download invoice using payment intent id
  static async downloadInvoiceFile(payment_intent_id: string) {
    const invoice = await Stripe.invoices.retrieve(payment_intent_id);

    if (invoice.hosted_invoice_url) {
      const response = await Fetch.get(invoice.hosted_invoice_url, {
        responseType: 'stream',
      });

      // save the response to a file
      return fs.writeFileSync('receipt.pdf', response.data);
    } else {
      return null;
    }
  }

  // send invoice to email using payment intent id
  static async sendInvoiceToEmail(payment_intent_id: string) {
    const invoice = await Stripe.invoices.sendInvoice(payment_intent_id);
    return invoice;
  }

  // -----------------------payout system start--------------------------------

  // If you are paying users, they need Stripe Connect accounts. You can create Express or Standard accounts.
  static async createConnectedAccount(email: string) {
    const connectedAccount = await Stripe.accounts.create({
      type: 'express',
      email: email,
      country: 'US', // change as per user's country
      // business_profile: {
      //   url: appConfig().app.url,
      // },
      // settings: {
      //   payouts: {
      //     schedule: {
      //       interval: 'manual',
      //     },
      //   },
      // },
      capabilities: {
        // card_payments: {
        //   enabled: true,
        // },
        transfers: {
          // enabled: true,
          requested: true,
        },
      },
    });

    return connectedAccount;
  }

  // Before making payouts, users must complete Stripe Connect onboarding.
  static async createOnboardingAccountLink(account_id: string) {
    const accountLink = await Stripe.accountLinks.create({
      account: account_id,
      refresh_url: appConfig().app.url,
      return_url: appConfig().app.url,
      type: 'account_onboarding',
    });

    return accountLink;
  }

  // transfer money to account
  static async createTransfer(
    account_id: string,
    amount: number,
    currency: string,
  ) {
    const transfer = await Stripe.transfers.create({
      amount: amount * 100,
      currency: currency,
      destination: account_id,
    });
    return transfer;
  }

  // Once the user has an approved Stripe account with a linked bank, you can send them funds.
  static async createPayout(
    account_id: string,
    amount: number,
    currency: string,
  ) {
    const payout = await Stripe.payouts.create(
      {
        amount: amount * 100, // amount in cents
        currency: currency,
      },
      {
        stripeAccount: account_id, // context of connected account
      },
    );

    return payout;
  }

  // check balance of account
  static async checkBalance(account_id: string) {
    const balance = await Stripe.balance.retrieve({
      stripeAccount: account_id,
    });
    return balance;
  }

  // static async createPayout(amount: number, currency: string) {
  //   const payout = await Stripe.payouts.create({
  //     amount: amount * 100,
  //     currency: currency,
  //   });
  //   return payout;
  // }
  // -----------------------payout system end--------------------------------

  // ACH payment
  static async createToken() {
    const token = await Stripe.tokens.create({
      bank_account: {
        country: 'US',
        currency: 'usd',
        routing_number: '110000000',
        account_number: '000123456789',
        account_holder_name: 'Jane Doe',
        account_holder_type: 'individual',
      },
    });
    return token;
  }

  static async createBankAccount(customerId: string, bankAccountToken: string) {
    const bankAccount = await Stripe.customers.createSource(customerId, {
      source: bankAccountToken,
    });
    return bankAccount;
  }

  static async verifyBankAccount(
    customerId: string,
    bankAccountId: string,
    amounts: [number, number],
  ) {
    return Stripe.customers.verifySource(customerId, bankAccountId, {
      amounts,
    });
  }

  static async createACHPaymentIntent(customerId: string, amount: number) {
    return await Stripe.paymentIntents.create({
      amount: amount * 100,
      currency: 'usd',
      customer: customerId,
      payment_method_types: ['us_bank_account'],
      payment_method_options: {
        us_bank_account: {
          verification_method: 'automatic',
        },
      },
    });
    // return await Stripe.checkout.sessions.create({
    //   mode: 'payment',
    //   customer: customerId,
    //   payment_method_types: ['card', 'us_bank_account'],
    //   payment_method_options: {
    //     us_bank_account: {
    //       verification_method: 'automatic',
    //     },
    //   },
    //   line_items: [
    //     {
    //       price_data: {
    //         currency: 'usd',
    //         unit_amount: amount * 100,
    //         product_data: {
    //           name: 'T-shirt',
    //         },
    //       },
    //       quantity: 1,
    //     },
    //   ],
    //   success_url: 'https://example.com/success',
    //   cancel_url: 'https://example.com/cancel',
    // });
  }
  // end ACH

  static handleWebhook(rawBody: string, sig: string | string[]): stripe.Event {
    const event = Stripe.webhooks.constructEvent(
      rawBody,
      sig,
      STRIPE_WEBHOOK_SECRET,
    );
    return event;
  }
}
