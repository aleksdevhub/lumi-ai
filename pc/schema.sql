IF DB_ID(N'LumiChats') IS NULL CREATE DATABASE LumiChats;
GO
USE LumiChats;
GO
IF OBJECT_ID('dbo.ChatMessages','U') IS NULL
BEGIN
  CREATE TABLE dbo.ChatMessages (
    SequenceId BIGINT IDENTITY PRIMARY KEY,
    TelegramUserId BIGINT NOT NULL,
    DialogId UNIQUEIDENTIFIER NOT NULL,
    MessageId UNIQUEIDENTIFIER NOT NULL,
    Role VARCHAR(9) NOT NULL CHECK(Role IN ('user','assistant')),
    Body NVARCHAR(MAX) NOT NULL,
    SentAtMs BIGINT NOT NULL,
    Thumbnail VARCHAR(MAX) NULL,
    UNIQUE (TelegramUserId, DialogId, MessageId)
  );
  CREATE INDEX IX_LumiSync ON dbo.ChatMessages(TelegramUserId,SequenceId);
END;
GO
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
CREATE OR ALTER PROCEDURE dbo.SyncChats @packet NVARCHAR(MAX)
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;
  DECLARE @owner BIGINT=CONVERT(BIGINT,JSON_VALUE(@packet,'$.user'));
  DECLARE @after BIGINT=CONVERT(BIGINT,JSON_VALUE(@packet,'$.after'));
  BEGIN TRANSACTION;
  INSERT INTO dbo.ChatMessages(TelegramUserId, DialogId, MessageId, Role, Body, SentAtMs, Thumbnail)
  SELECT @owner, p.dialog, p.id, p.role, p.[text], p.at, p.thumb
  FROM OPENJSON(@packet,'$.items') WITH (
    dialog UNIQUEIDENTIFIER, id UNIQUEIDENTIFIER, role VARCHAR(9),
    [text] NVARCHAR(MAX), at BIGINT, thumb VARCHAR(MAX)
  ) AS p WHERE NOT EXISTS (SELECT 1 FROM dbo.ChatMessages WITH (UPDLOCK,HOLDLOCK)
    WHERE TelegramUserId=@owner AND DialogId=p.dialog AND MessageId=p.id);
  COMMIT;
  DECLARE @result NVARCHAR(MAX)=(SELECT TOP(15) SequenceId AS seq,
    LOWER(CONVERT(VARCHAR(36),DialogId)) AS dialog, LOWER(CONVERT(VARCHAR(36),MessageId)) AS id,
    Role AS role, Body AS [text], SentAtMs AS at, Thumbnail AS thumb
    FROM dbo.ChatMessages WHERE TelegramUserId=@owner AND SequenceId>@after ORDER BY SequenceId FOR JSON PATH);
  DECLARE @bytes VARBINARY(MAX)=CONVERT(VARBINARY(MAX),@result);
  SELECT CAST('' AS XML).value('xs:base64Binary(sql:variable("@bytes"))','varchar(max)');
END;
GO
