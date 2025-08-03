import { defaultProps } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";

export const TitleBlock = createReactBlockSpec(
	{
		content: "inline",
		propSchema: {
			backgroundColor: defaultProps.backgroundColor,
			textAlignment: defaultProps.textAlignment,
			textColor: defaultProps.textColor,
		},
		type: "title",
	},
	{
		render: (props) => {
			const { contentRef } = props;
			return (
				<h1
					className="!text-4xl font-bold"
					style={{
						backgroundColor:
							props.block.props.backgroundColor !== "default"
								? (props.block.props.backgroundColor as string)
								: undefined,
						color:
							props.block.props.textColor !== "default"
								? (props.block.props.textColor as string)
								: undefined,
						textAlign:
							(props.block.props.textAlignment as
								| "left"
								| "center"
								| "right"
								| "justify") || "left",
					}}
					ref={contentRef}
				>
					{/* text handled by contentRef */}
				</h1>
			);
		},
	},
);
