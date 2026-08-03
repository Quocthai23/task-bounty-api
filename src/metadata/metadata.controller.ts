import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MetadataService } from './metadata.service';

@ApiTags('Metadata')
@Controller('metadata')
export class MetadataController {
  constructor(private readonly metadataService: MetadataService) {}
  
  @ApiOperation({ summary: 'Get all dynamic skills extracted from DB and projects' })
  @ApiResponse({ status: 200, description: 'List of dynamic skills.' })
  @Get('skills')
  async getSkills() {
    return this.metadataService.getSkills();
  }

  @ApiOperation({ summary: 'Get all dynamic positions extracted from DB' })
  @ApiResponse({ status: 200, description: 'List of positions.' })
  @Get('positions')
  async getPositions() {
    return this.metadataService.getPositions();
  }

  @ApiOperation({ summary: 'Get dynamic budget ranges and presets based on active projects' })
  @ApiResponse({ status: 200, description: 'Budget range and presets.' })
  @Get('budget-ranges')
  async getBudgetRanges() {
    return this.metadataService.getBudgetRanges();
  }
}
