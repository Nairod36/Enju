import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './user-response.dto';

export class AuthResponseDto {
    @ApiProperty({
        description: 'JWT access token',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
    })
    accessToken: string;

    @ApiProperty({
        description: 'User information',
        type: UserResponseDto
    })
    user: UserResponseDto;

    @ApiProperty({
        description: 'Whether this is a new user',
        example: false
    })
    isNewUser: boolean;
}