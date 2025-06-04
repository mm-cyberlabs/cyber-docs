package com.mmcyberlabs.cyberdocs.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.rsocket.RSocketStrategies;
import org.springframework.messaging.rsocket.annotation.support.RSocketMessageHandler;

@Configuration
public class RSocketCofig {
    /**
     * Configures RSocket strategies for encoding/decoding.
     *
     * @return RSocketStrategies with JSON support
     */
    @Bean
    public RSocketStrategies rSocketStrategies() {
        return RSocketStrategies.builder()
                .build();
    }

    /**
     * Creates RSocket message handler for processing requests.
     *
     * @param strategies RSocket strategies for message handling
     * @return Configured RSocketMessageHandler
     */
    @Bean
    public RSocketMessageHandler rSocketMessageHandler(RSocketStrategies strategies) {
        RSocketMessageHandler handler = new RSocketMessageHandler();
        handler.setRSocketStrategies(strategies);
        return handler;
    }
}
