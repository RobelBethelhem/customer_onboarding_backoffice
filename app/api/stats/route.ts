import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Customer from '@/lib/models/Customer';

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    // Get counts by status
    const statusCounts = await Customer.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const counts: Record<string, number> = {
      total: 0,
      pending: 0,
      verified: 0,
      approved: 0,
      auto_approved: 0,
      rejected: 0,
    };

    statusCounts.forEach((c: { _id: string; count: number }) => {
      counts[c._id] = c.count;
      counts.total += c.count;
    });

    // Get today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayStats = await Customer.aggregate([
      {
        $match: {
          createdAt: { $gte: today }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const todayCounts: Record<string, number> = {
      total: 0,
      pending: 0,
      approved: 0,
      auto_approved: 0,
      rejected: 0,
    };

    todayStats.forEach((c: { _id: string; count: number }) => {
      todayCounts[c._id] = c.count;
      todayCounts.total += c.count;
    });

    // Get daily stats for last 14 days
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const dailyStats = await Customer.aggregate([
      {
        $match: {
          createdAt: { $gte: fourteenDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            status: '$status'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          statuses: {
            $push: {
              status: '$_id.status',
              count: '$count'
            }
          },
          total: { $sum: '$count' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Format daily stats
    const formattedDailyStats = dailyStats.map((day: any) => {
      const stats: any = {
        date: day._id,
        newAccounts: day.total,
        pendingReview: 0,
        approved: 0,
        autoApproved: 0,
        rejected: 0,
      };

      day.statuses.forEach((s: { status: string; count: number }) => {
        if (s.status === 'pending' || s.status === 'verified') {
          stats.pendingReview += s.count;
        } else if (s.status === 'approved') {
          stats.approved = s.count;
        } else if (s.status === 'auto_approved') {
          stats.autoApproved = s.count;
        } else if (s.status === 'rejected') {
          stats.rejected = s.count;
        }
      });

      return stats;
    });

    // Get account type distribution
    const accountTypeStats = await Customer.aggregate([
      {
        $group: {
          _id: '$accountType',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    const totalCustomers = counts.total || 1;
    const formattedAccountTypes = accountTypeStats.map((at: any) => ({
      type: at._id,
      count: at.count,
      percentage: Math.round((at.count / totalCustomers) * 100),
    }));

    return NextResponse.json({
      success: true,
      data: {
        counts,
        todayCounts,
        dailyStats: formattedDailyStats,
        accountTypeStats: formattedAccountTypes,
      },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
