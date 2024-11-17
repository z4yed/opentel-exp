export const lambdaHandler = async (event, context) => {
  console.log("event", event);
  console.log("context", context);

  console.log("Remaining time: ", context.getRemainingTimeInMillis());
  console.log("Function name: ", context.functionName);

  const response = {
    statusCode: 200,
    body: JSON.stringify({
      message: "hello world",
    }),
  };

  return response;
};
