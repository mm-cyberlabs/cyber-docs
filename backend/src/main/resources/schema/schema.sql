CREATE SCHEMA metrics;

drop table metrics.user_metrics;
create table metrics.user_metrics
(
    id            serial primary key not null,
    authenticator varchar(20)        not null unique,
    sign_in_users int default 0,
    step_up_users int default 0
);

drop table metrics.user_online;
create table metrics.user_online
(
    id                        serial primary key not null,
    user_uuid                 varchar(36)        not null unique,
    jti                       varchar(36)        not null,
    online_start_datetime     timestamptz        not null,
    token_expiration_datetime timestamptz        not null,
    renewal_count             int default 0      not null
);