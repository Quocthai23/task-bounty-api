import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Metadata')
@Controller('metadata')
export class MetadataController {
  
  @ApiOperation({ summary: 'Get all predefined skills' })
  @ApiResponse({ status: 200, description: 'List of skills.' })
  @Get('skills')
  getSkills() {
    return [
      'Reactjs', 'Nodejs', 'Python', 'C#', 'Nextjs', 'Java', 
      'Go', 'Ruby', 'Swift', 'Kotlin', 'TypeScript', 'Docker',
      'Kubernetes', 'AWS', 'Azure', 'GCP', 'PostgreSQL', 'MongoDB'
    ];
  }

  @ApiOperation({ summary: 'Get all predefined positions' })
  @ApiResponse({ status: 200, description: 'List of positions.' })
  @Get('positions')
  getPositions() {
    return [
      'Front End', 'Back End', 'Full Stack', 'Database', 
      'Design', 'DevOps', 'Mobile', 'QA', 'Project Manager'
    ];
  }
}
