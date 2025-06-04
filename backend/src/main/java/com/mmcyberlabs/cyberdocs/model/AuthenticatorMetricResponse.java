package com.mmcyberlabs.cyberdocs.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthenticatorMetricResponse {

    private String authenticator;
    private int signInUserCount;
    private int signOffUserCount;
}
