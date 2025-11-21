import { PartialType } from '@nestjs/swagger';
import { CreatePrometheusDto } from './create-prometheus.dto';

export class UpdatePrometheusDto extends PartialType(CreatePrometheusDto) {}
