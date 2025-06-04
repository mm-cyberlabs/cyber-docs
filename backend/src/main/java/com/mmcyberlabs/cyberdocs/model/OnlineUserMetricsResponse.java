package com.mmcyberlabs.cyberdocs.model;

import lombok.Builder;
import lombok.Data;

/**
 * {@link OnlineUserMetricsResponse} current online users and user's that haven't gone online for over a week.
 */
@Data
@Builder
public class OnlineUserMetricsResponse {

    /**
     * Current online users count
     */
    private int onlineUserCount;

    /**
     * Stale user count, not logged in for a week at least
     */
    private int staleUserCount;
}
