package com.mmcyberlabs.cyberdocs.events;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;

/**
 * {@link OnlineUserEvent) event of all the user's that are online and when they expire.
 */
@Data
@Builder
public class OnlineUserEvent {

    private Long id;
    private String userUuid;
    private String jti;
    private Instant onlineStartDatetime;
    private Instant tokenExpirationDatetime;
    private int renewalCount;
    private String operation;
    private String sourceOfRecord;
    private Instant instant;
}
