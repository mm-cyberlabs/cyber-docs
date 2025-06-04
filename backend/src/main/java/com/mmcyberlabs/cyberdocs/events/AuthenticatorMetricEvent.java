package com.mmcyberlabs.cyberdocs.events;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * {@link AuthenticatorMetricEvent} maintains a stream of how many times an authenticator it's used.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthenticatorMetricEvent {

    private Long id;
    private String authenticator;
    private int signInUserCount;
    private int signOffUserCount;
    private String operation;
    private String sourceOfRecord;
    private Instant instant;
}
