import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { RewardsService } from './rewards.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('rewards')
export class RewardsController {
    constructor(private readonly rewardsService: RewardsService) {}

    @Get('balance')
    async getRewardBalance(@Query('address') address: string) {
        if (!address) {
            return { error: 'Address parameter required' };
        }

        const balance = await this.rewardsService.getUserRewardBalance(address);
        return { balance };
    }

    @Get('stats')
    async getRewardStats(@Query('address') address: string) {
        if (!address) {
            return { error: 'Address parameter required' };
        }

        const stats = await this.rewardsService.getUserRewardStats(address);
        return stats;
    }

    @Get('calculate')
    calculateReward(
        @Query('amount') amount: string,
        @Query('token') token: string
    ) {
        if (!amount || !token) {
            return { error: 'Amount and token parameters required' };
        }

        const rewardAmount = this.rewardsService.calculateReward(
            parseFloat(amount), 
            token
        );

        return {
            amount: parseFloat(amount),
            token: token.toUpperCase(),
            rewardAmount,
            rewardToken: 'REWARD'
        };
    }

    @Post('mint')
    @UseGuards(JwtAuthGuard)
    async mintReward(@Body() body: {
        userAddress: string;
        amount: number;
        tokenSymbol: string;
    }) {
        const { userAddress, amount, tokenSymbol } = body;

        if (!userAddress || !amount || !tokenSymbol) {
            return { error: 'Missing required parameters' };
        }

        const txHash = await this.rewardsService.mintRewardTokens(
            userAddress,
            amount,
            tokenSymbol
        );

        if (txHash) {
            return {
                success: true,
                txHash,
                rewardAmount: this.rewardsService.calculateReward(amount, tokenSymbol)
            };
        } else {
            return {
                success: false,
                error: 'Failed to mint reward tokens'
            };
        }
    }
}