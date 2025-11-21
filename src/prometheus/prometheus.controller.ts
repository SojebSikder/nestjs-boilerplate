import { Controller, Get, Res } from '@nestjs/common';
import { PrometheusService } from './prometheus.service';
import { Response } from 'express';
import { Counter } from 'prom-client';

@Controller('metrics')
export class PrometheusController {
  private httpRequestCounter;
  constructor(private readonly prometheusService: PrometheusService) {
    this.httpRequestCounter = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
    });
  }

  @Get('hello')
  hello() {
    this.httpRequestCounter.inc();
    return 'Hello!';
  }

  @Get()
  async getMetrics(@Res() res: Response) {
    const metrics = await this.prometheusService.getMetrics();
    res.setHeader('Content-Type', 'text/plain');
    res.send(metrics);
  }
}
