package com.mmcyberlabs.cyberdocs;


import com.mmcyberlabs.cyberdocs.events.AuthenticatorMetricEvent;
import com.mmcyberlabs.cyberdocs.events.OnlineUserEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Sinks;

/**
 * Publishes metric events to reactive streams.
 * Acts as a bridge between CDC events and RSocket subscribers.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MetricEventPublisher {

    private final Sinks.Many<AuthenticatorMetricEvent> authenticatorMetricSink =
            Sinks.many().multicast().onBackpressureBuffer();

    private final Sinks.Many<OnlineUserEvent> onlineUserMetricSink =
            Sinks.many().multicast().onBackpressureBuffer();

    /**
     * Publishes a metric event to all subscribers.
     *
     * @param event The metric event to publish
     */
    public void publishEvent(AuthenticatorMetricEvent event) {
        authenticatorMetricSink.tryEmitNext(event);
        log.debug("Published an authenticator event to {} subscribers", authenticatorMetricSink.currentSubscriberCount());
    }

    public void publishEvent(OnlineUserEvent events) {
        onlineUserMetricSink.tryEmitNext(events);
        log.debug("Published an online user event to {} subscribers", onlineUserMetricSink.currentSubscriberCount());
    }

    /**
     * Returns a Flux of metric events for subscribers.
     *
     * @return Flux of {@link AuthenticatorMetricEvent}
     */
    public Flux<AuthenticatorMetricEvent> getAuthenticatorEventStream() {
        return authenticatorMetricSink.asFlux();
    }

    /**
     * Returns a Flux of Online User EVent for subscribers.
     *
     * @return Flux of {@link OnlineUserEvent}
     */
    public Flux<OnlineUserEvent> getOnlineUserEventStream() {
        return onlineUserMetricSink.asFlux();
    }
}
